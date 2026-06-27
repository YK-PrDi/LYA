package com.lyauto.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lyauto.config.AppProperties;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * AI 生图 / 视觉分析 / 文本生成的 HTTP 客户端层。
 * 从 ImageGenService 抽出：所有对外 API 调用（Gemini / gpt-image-2 / DashScope 文本）、
 * 密钥轮换游标、图片落盘。keyCursor 必须是单例（Spring 注入），保证多 SKU 并发时轮换连续。
 */
@Component
public class AiImageClient {

    private static final Logger log = LoggerFactory.getLogger(AiImageClient.class);

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();
    /** 密钥轮换游标（全局单例，保证并发轮换连续）。 */
    final AtomicInteger keyCursor = new AtomicInteger(0);

    public AiImageClient(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    /** 按配置构建 HTTP 客户端（可选代理）。 */
    OkHttpClient buildHttp() {
        OkHttpClient.Builder b = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .readTimeout(300, TimeUnit.SECONDS);
        AppProperties.GptImage cfg = appProperties.getGptImage();
        if (cfg.getProxyHost() != null && !cfg.getProxyHost().isBlank() && cfg.getProxyPort() > 0) {
            b.proxy(new java.net.Proxy(java.net.Proxy.Type.HTTP,
                new java.net.InetSocketAddress(cfg.getProxyHost(), cfg.getProxyPort())));
        }
        return b.build();
    }

    /** 不带代理的 HTTP 客户端（国内接口如 DashScope 直连，避免走生图用的境外代理）。 */
    OkHttpClient buildHttpNoProxy() {
        return new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .readTimeout(300, TimeUnit.SECONDS)
            .build();
    }

    /** 生图输出目录：用户数据目录下 sku-gen/<batch>/ */
    File outputDir(String batch) {
        File dir = new File(appProperties.getPaths().getUserDataDir(), "sku-gen/" + batch);
        dir.mkdirs();
        return dir;
    }

    /**
     * 解码 b64 图片，缩放到最长边 ≤1024，转 JPG 保存（quality 0.9），返回输出文件。
     * 拼多多对单图尺寸/体积有限制，2K PNG 偏大易上传失败，故统一压成 1024 JPG。
     */
    File saveAsJpg(String b64, String batch, int seq, String skuName) throws Exception {
        byte[] raw = Base64.getDecoder().decode(b64);
        BufferedImage src = ImageIO.read(new java.io.ByteArrayInputStream(raw));
        if (src == null) throw new RuntimeException("生图返回的图片无法解码");
        int max = 1024;
        int w = src.getWidth(), h = src.getHeight();
        BufferedImage out;
        if (w > max || h > max) {
            double scale = Math.min((double) max / w, (double) max / h);
            int nw = (int) Math.round(w * scale), nh = (int) Math.round(h * scale);
            out = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = out.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(src, 0, 0, nw, nh, null);
            g.dispose();
        } else {
            // 不放大；仅去掉 alpha 通道以便存 JPG
            out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = out.createGraphics();
            g.drawImage(src, 0, 0, null);
            g.dispose();
        }
        // 文件名用「序号_款式名」，款式名清洗掉非法字符；为空则只用序号
        String safe = skuName == null ? "" : skuName.trim().replaceAll("[\\\\/:*?\"<>|]", "_");
        if (safe.length() > 40) safe = safe.substring(0, 40);
        String fileName = safe.isEmpty() ? (seq + ".jpg") : (seq + "_" + safe + ".jpg");
        File dst = new File(outputDir(batch), fileName);
        javax.imageio.ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(0.9f);
        try (javax.imageio.stream.ImageOutputStream ios = ImageIO.createImageOutputStream(dst)) {
            writer.setOutput(ios);
            writer.write(null, new javax.imageio.IIOImage(out, null, null), param);
        } finally {
            writer.dispose();
        }
        return dst;
    }

    private static int parseFilterCount(String compDesc) {
        if (compDesc == null || compDesc.isBlank()) return 0;
        Matcher m = Pattern.compile("(\\d+)\\s*支?\\s*滤芯").matcher(compDesc);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    /**
     * 公开入口：对一张主图分析背景风格，返回简短中文描述。
     * 供控制器对同批 SKU 只分析一次、全批共享同一背景。失败返回空串（不抛）。
     */
    public String analyzeBackgroundStyleOnce(String refImagePath) {
        try {
            File ref = new File(refImagePath);
            if (!ref.isFile()) return "";
            AppProperties.GptImage cfg = appProperties.getGptImage();
            // gemini：用原生视觉分析；其它(openai/gpt-image-2)：背景分析改走文本模型(qwen-vl 看图)
            if ("gemini".equalsIgnoreCase(cfg.getProvider())) {
                List<String> keys = cfg.keyList();
                if (keys.isEmpty()) return "";
                String bg = analyzeBackgroundStyle(buildHttp(), cfg.getBaseUrl(), keys.get(0), ref);
                return bg == null ? "" : bg.trim();
            }
            // A 方案：qwen-vl 看图出背景描述（与生图 provider 解耦，整批只调一次）
            String prompt = PromptLoader.load("prompt/image-analyze-bg-style.txt");
            String bg = geminiText(prompt, List.of(refImagePath));
            return bg == null ? "" : bg.trim();
        } catch (Exception e) {
            log.warn("批量背景分析失败: {}", e.getMessage());
            return "";   // 失败→空串，由 B 方案兜底（editInstruction 固定「以主图为背景」话术）
        }
    }

    /** 只提取参考图的背景风格（颜色/材质/光感），返回简短中文描述。 */
    @SuppressWarnings("unchecked")
    String analyzeBackgroundStyle(OkHttpClient http, String baseUrl, String key, File ref) throws Exception {
        String sys = PromptLoader.load("prompt/image-analyze-bg-style.txt");
        List<Object> parts = new java.util.ArrayList<>();
        parts.add(Map.of("text", sys));
        String data = Base64.getEncoder().encodeToString(Files.readAllBytes(ref.toPath()));
        parts.add(Map.of("inline_data", Map.of("mime_type", mimeOf(ref), "data", data)));
        Map<String, Object> payload = Map.of("contents", List.of(Map.of("parts", parts)));
        String json = objectMapper.writeValueAsString(payload);
        String url = baseUrl + "/v1beta/models/gemini-2.5-flash:generateContent?key=" + key;
        Request req = new Request.Builder()
            .url(url).header("Content-Type", "application/json")
            .post(RequestBody.create(json, MediaType.parse("application/json"))).build();
        try (Response resp = http.newCall(req).execute()) {
            String body = resp.body() != null ? resp.body().string() : "";
            if (!resp.isSuccessful()) throw new RuntimeException("背景分析 HTTP " + resp.code() + ": " + body);
            Map<String, Object> m = objectMapper.readValue(body, Map.class);
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) m.get("candidates");
            if (candidates == null || candidates.isEmpty()) return null;
            Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
            List<Map<String, Object>> rparts = (List<Map<String, Object>>) content.get("parts");
            StringBuilder sb = new StringBuilder();
            for (Map<String, Object> p : rparts) {
                Object t = p.get("text");
                if (t instanceof String) sb.append((String) t);
            }
            return sb.toString().trim();
        }
    }

    /** 阶段一：用 Gemini 视觉模型分析参考图，产出结构化英文生图 prompt。 */
    @SuppressWarnings("unchecked")
    String analyzeRefImage(OkHttpClient http, String baseUrl, String key, File ref,
                           String skuName, String productType, String compDesc) throws Exception {
        int filterCount = parseFilterCount(compDesc);
        String filterNote = filterCount > 0
            ? " (including exactly " + filterCount + " filter cartridges)" : "";

        String template = PromptLoader.load("prompt/image-sku-analyze-ref.txt");
        String sys = template
            .replace("{{productType}}", productType == null ? "" : productType)
            .replace("{{compDesc}}",    compDesc == null || compDesc.isBlank() ? "single main item" : compDesc)
            .replace("{{filterNote}}",  filterNote);

        // 用视觉文本模型（flash），非生图模型
        String visionModel = "gemini-2.5-flash";
        List<Object> parts = new java.util.ArrayList<>();
        parts.add(Map.of("text", sys));
        String data = Base64.getEncoder().encodeToString(Files.readAllBytes(ref.toPath()));
        parts.add(Map.of("inline_data", Map.of("mime_type", mimeOf(ref), "data", data)));
        Map<String, Object> payload = Map.of("contents", List.of(Map.of("parts", parts)));
        String json = objectMapper.writeValueAsString(payload);

        String url = baseUrl + "/v1beta/models/" + visionModel + ":generateContent?key=" + key;
        Request req = new Request.Builder()
            .url(url).header("Content-Type", "application/json")
            .post(RequestBody.create(json, MediaType.parse("application/json"))).build();
        try (Response resp = http.newCall(req).execute()) {
            String body = resp.body() != null ? resp.body().string() : "";
            if (!resp.isSuccessful()) throw new RuntimeException("分析 HTTP " + resp.code() + ": " + body);
            Map<String, Object> m = objectMapper.readValue(body, Map.class);
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) m.get("candidates");
            if (candidates == null || candidates.isEmpty()) return null;
            Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
            List<Map<String, Object>> rparts = (List<Map<String, Object>>) content.get("parts");
            StringBuilder sb = new StringBuilder();
            for (Map<String, Object> p : rparts) {
                Object t = p.get("text");
                if (t instanceof String) sb.append((String) t);
            }
            return sb.toString().trim();
        }
    }

    /** Gemini generateContent 图生图/文生图。多张参考图作为 inline_data 传入。返回 b64。 */
    @SuppressWarnings("unchecked")
    String callGemini(OkHttpClient http, String baseUrl, String key, String model,
                      String prompt, List<File> refs) throws Exception {
        List<Object> parts = new java.util.ArrayList<>();
        parts.add(Map.of("text", prompt));
        if (refs != null) {
            for (File ref : refs) {
                if (ref == null || !ref.isFile()) continue;
                String data = Base64.getEncoder().encodeToString(Files.readAllBytes(ref.toPath()));
                parts.add(Map.of("inline_data", Map.of("mime_type", mimeOf(ref), "data", data)));
            }
        }
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("contents", List.of(Map.of("parts", parts)));
        // 生图质量参数：responseModalities + 宽高比/分辨率（gemini-3-pro-image 支持）
        AppProperties.GptImage cfg = appProperties.getGptImage();
        Map<String, Object> genCfg = new java.util.LinkedHashMap<>();
        genCfg.put("responseModalities", List.of("TEXT", "IMAGE"));
        genCfg.put("responseFormat", Map.of("image", Map.of(
            "aspectRatio", cfg.getAspectRatio(),
            "imageSize",   cfg.getImageSize())));
        payload.put("generationConfig", genCfg);
        String json = objectMapper.writeValueAsString(payload);

        String url = baseUrl + "/v1beta/models/" + model + ":generateContent?key=" + key;
        Request req = new Request.Builder()
            .url(url)
            .header("Content-Type", "application/json")
            .post(RequestBody.create(json, MediaType.parse("application/json"))).build();

        try (Response resp = http.newCall(req).execute()) {
            String body = resp.body() != null ? resp.body().string() : "";
            if (!resp.isSuccessful()) throw new RuntimeException("Gemini HTTP " + resp.code() + ": " + body);
            Map<String, Object> m = objectMapper.readValue(body, Map.class);
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) m.get("candidates");
            if (candidates == null || candidates.isEmpty()) throw new RuntimeException("无候选返回: " + body);
            Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
            List<Map<String, Object>> rparts = (List<Map<String, Object>>) content.get("parts");
            for (Map<String, Object> p : rparts) {
                Map<String, Object> inline = (Map<String, Object>) p.get("inlineData");
                if (inline == null) inline = (Map<String, Object>) p.get("inline_data");
                if (inline != null) {
                    Object d = inline.get("data");
                    if (d instanceof String && !((String) d).isBlank()) return (String) d;
                }
            }
            throw new RuntimeException("响应无图片数据: " + body);
        }
    }

    /** gpt-image-2 图生图/文生图。multipart form 调用。返回 b64。 */
    @SuppressWarnings("unchecked")
    String callGptImage2(OkHttpClient http, String baseUrl, String key, String model,
                         String prompt, List<File> refs) throws Exception {
        String boundary = "----GptImageBoundary" + Long.toHexString(System.currentTimeMillis());
        java.net.URL url = new java.net.URL(baseUrl + "/v1/images/edits");
        java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
        conn.setRequestProperty("Authorization", "Bearer " + key);
        conn.setDoOutput(true);
        conn.setConnectTimeout(30_000);
        conn.setReadTimeout(300_000);

        try (java.io.OutputStream os = conn.getOutputStream()) {
            writeField(os, boundary, "model", model);
            writeField(os, boundary, "prompt", prompt != null ? prompt : "product photo");
            writeField(os, boundary, "size", "1024x1024");
            writeField(os, boundary, "quality", "high");
            writeField(os, boundary, "output_format", "jpeg");
            if (refs != null) {
                String fieldName = refs.size() == 1 ? "image" : "image[]";
                for (File f : refs) {
                    writeFile(os, boundary, fieldName, f);
                }
            }
            os.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        }

        int status = conn.getResponseCode();
        String respBody;
        try (java.io.InputStream is = (status >= 200 && status < 300) ? conn.getInputStream() : conn.getErrorStream()) {
            respBody = new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } finally {
            conn.disconnect();
        }

        if (status < 200 || status >= 300) {
            throw new RuntimeException("gpt-image-2 HTTP " + status + ": " + respBody);
        }

        Map<String, Object> m = objectMapper.readValue(respBody, Map.class);
        List<Map<String, Object>> data = (List<Map<String, Object>>) m.get("data");
        if (data == null || data.isEmpty()) throw new RuntimeException("无图片返回: " + respBody);
        Map<String, Object> item = data.get(0);
        Object b64 = item.get("b64_json");
        if (b64 instanceof String && !((String) b64).isBlank()) return (String) b64;
        Object imgUrl = item.get("url");
        if (imgUrl instanceof String && !((String) imgUrl).isBlank()) {
            // 下载转 b64
            java.net.URL dl = new java.net.URL((String) imgUrl);
            java.net.HttpURLConnection c2 = (java.net.HttpURLConnection) dl.openConnection();
            c2.setConnectTimeout(15_000);
            c2.setReadTimeout(60_000);
            try (java.io.InputStream in = c2.getInputStream()) {
                return Base64.getEncoder().encodeToString(in.readAllBytes());
            } finally { c2.disconnect(); }
        }
        throw new RuntimeException("响应无 b64_json/url: " + respBody);
    }

    private void writeField(java.io.OutputStream os, String boundary, String name, String value) throws Exception {
        String part = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"
                + value + "\r\n";
        os.write(part.getBytes(StandardCharsets.UTF_8));
    }

    private void writeFile(java.io.OutputStream os, String boundary, String fieldName, File file) throws Exception {
        String filename = file.getName();
        String mime = filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
        String header = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + mime + "\r\n\r\n";
        os.write(header.getBytes(StandardCharsets.UTF_8));
        os.write(Files.readAllBytes(file.toPath()));
        os.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    /** gpt-image-2 文生图（无参考图）。返回 b64。 */
    String callGptImage2TextOnly(OkHttpClient http, String baseUrl, String key,
                                 String model, String prompt) throws Exception {
        return callGptImage2(http, baseUrl, key, model, prompt, java.util.List.of());
    }

    String mimeOf(File f) {
        String n = f.getName().toLowerCase();
        return n.endsWith(".png") ? "image/png" : n.endsWith(".webp") ? "image/webp" : "image/jpeg";
    }

    /**
     * 文本/多模态生成：返回纯文本。供标题/款式名生成复用。
     * 走 app.text 配置（默认阿里云百炼 DashScope，OpenAI 兼容 chat/completions，qwen-vl-plus）。
     * imagePaths 为空则纯文本；否则把图片作为 image_url(data URI) 一起传（最多3张）。
     */
    @SuppressWarnings("unchecked")
    public String geminiText(String prompt, List<String> imagePaths) throws Exception {
        AppProperties.TextGen cfg = appProperties.getText();
        String key = cfg.getApiKey();
        if (key == null || key.isBlank()) throw new RuntimeException("文本生成密钥未配置（app.text.api-key）");
        String baseUrl = cfg.getBaseUrl();
        String model = cfg.getModel();
        OkHttpClient http = buildHttpNoProxy();  // DashScope 国内直连，不走生图境外代理

        // OpenAI 兼容多模态：content 为数组，含 {type:text} 和 {type:image_url}
        List<Object> content = new java.util.ArrayList<>();
        content.add(Map.of("type", "text", "text", prompt));
        if (imagePaths != null) {
            int n = 0;
            for (String p : imagePaths) {
                if (n >= 3) break;
                File f = new File(p);
                if (!f.isFile()) continue;
                String data = Base64.getEncoder().encodeToString(Files.readAllBytes(f.toPath()));
                String dataUri = "data:" + mimeOf(f) + ";base64," + data;
                content.add(Map.of("type", "image_url", "image_url", Map.of("url", dataUri)));
                n++;
            }
        }
        Map<String, Object> payload = Map.of(
            "model", model,
            "messages", List.of(Map.of("role", "user", "content", content)));
        String json = objectMapper.writeValueAsString(payload);

        String url = baseUrl + "/chat/completions";
        Request req = new Request.Builder()
            .url(url)
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + key)
            .post(RequestBody.create(json, MediaType.parse("application/json"))).build();
        try (Response resp = http.newCall(req).execute()) {
            String body = resp.body() != null ? resp.body().string() : "";
            if (!resp.isSuccessful()) throw new RuntimeException("文本生成 HTTP " + resp.code() + ": " + body);
            Map<String, Object> m = objectMapper.readValue(body, Map.class);
            List<Map<String, Object>> choices = (List<Map<String, Object>>) m.get("choices");
            if (choices == null || choices.isEmpty()) throw new RuntimeException("无候选返回: " + body);
            Map<String, Object> msg = (Map<String, Object>) choices.get(0).get("message");
            Object c = msg == null ? null : msg.get("content");
            return c == null ? "" : String.valueOf(c).trim();
        }
    }
}
