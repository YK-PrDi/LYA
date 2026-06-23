package com.lyauto.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lyauto.config.AppProperties;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;

/**
 * GPT Image 生图服务（OpenAI 兼容接口）。
 * 以参考主图为底，按 SKU 布局描述生成 SKU 展示图。多密钥轮换。
 */
@Service
public class ImageGenService {

    private static final Logger log = LoggerFactory.getLogger(ImageGenService.class);

    private final AppProperties appProperties;
    private final PromptTemplateService templateService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final AtomicInteger keyCursor = new AtomicInteger(0);

    public ImageGenService(AppProperties appProperties, PromptTemplateService templateService) {
        this.appProperties = appProperties;
        this.templateService = templateService;
    }

    /** 从 compDesc（如"全配+5支滤芯【可用1年】"）提取滤芯数量，无匹配返回 0 */
    private static int parseFilterCount(String compDesc) {
        if (compDesc == null || compDesc.isBlank()) return 0;
        Matcher m = Pattern.compile("(\\d+)\\s*支?\\s*滤芯").matcher(compDesc);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    /** 款式名含「滤芯」但没写数字时的默认滤芯数 */
    private static int filterCountFor(String compDesc) {
        int n = parseFilterCount(compDesc);
        if (n > 0) return n;
        return (compDesc != null && compDesc.contains("滤芯")) ? 1 : 0;
    }

    private static boolean hasHose(String d) { return d != null && (d.contains("软管") || d.contains("水管")); }
    private static boolean hasBase(String d) { return d != null && (d.contains("底座") || d.contains("支架") || d.contains("挂座")); }

    /** 拼配件横幅信息：用配件文件名（含 1.5米/2米 软管区分）+ 滤芯数量，写进图生图指令。 */
    private static String buildAccInfo(List<File> accFiles, java.util.List<String> accLabels, int filterShow) {
        java.util.List<String> parts = new java.util.ArrayList<>();
        for (int i = 0; i < accFiles.size(); i++) {
            String label = accLabels.get(i);
            String nm = accFiles.get(i).getName().replaceAll("\\.[^.]+$", "");
            if ("滤芯".equals(label)) parts.add(filterShow + "支滤芯");
            else if ("软管".equals(label)) parts.add(nm.contains("2米") ? "2米软管" : (nm.contains("1.5") ? "1.5米软管" : "软管"));
            else if ("底座".equals(label)) parts.add("底座");
            else parts.add(nm);
        }
        return parts.isEmpty() ? "无配件" : String.join(" / ", parts);
    }

    /**
     * 由款式名（compDesc）决定花洒左侧构图：配件/批量件做成「圆角矩形白底展示卡」——
     * 卡片中上部展示配件、卡片最底部是一条与场景背景同色的横幅、横幅内写该配件信息。
     * 左下水质对比维持原样（不做成卡片）。返回中文左侧构图描述，填入模板 {{leftLayout}}。
     */
    private static String buildShowerAccDesc(String compDesc, boolean hasWater) {
        int filters = filterCountFor(compDesc);
        boolean hose = hasHose(compDesc);
        boolean base = hasBase(compDesc);
        boolean hasAcc = filters > 0 || hose || base;

        String cardSpec = "展示卡为圆润边角的矩形白底卡片，卡片中上部为配件展示区（配件居中、留白干净），"
            + "卡片最底部是一条与整图场景背景同色的横幅，横幅内用简短文字标明该配件信息；";

        // 左下水质对比保持原样：直接摆在场景背景上、不做成白底卡片，文字由模板的「过滤前/过滤后」段处理
        String cups = hasWater
            ? "左下层放左右并排的两个玻璃杯做水质对比：只复刻水质对比白底图里两个杯子和杯中水的颜色/浑浊度（左杯浑浊黄水、右杯清澈透明水），不要复制那张参考图的白色背景。两个杯子直接坐落在整图统一的场景背景上，杯子四周不要任何白色衬底或白色方块。"
            : "左下层放左右并排的两个玻璃杯（左杯浑浊黄水、右杯清澈透明水），两杯外形一致仅水质不同，直接坐落在场景背景上，杯子四周不要任何白色衬底。";

        if (!hasAcc) {
            return "本款式无搭配配件，左侧不放任何配件展示卡，仅" + cups
                 + "不要添加软管、滤芯、底座或任何额外物体。";
        }
        List<String> accTop = new java.util.ArrayList<>();   // 配件（软管/底座）→ 左上
        if (hose) accTop.add("软管");
        if (base) accTop.add("底座");
        StringBuilder sb = new StringBuilder();
        if (!accTop.isEmpty()) {
            sb.append("左上层放搭配配件展示卡：").append(String.join("、", accTop))
              .append("各自做成一张圆角白底展示卡，").append(cardSpec)
              .append("配件相对主体适当缩小、卡片之间独立分开不重叠。");
        }
        if (filters > 0) {
            sb.append("左中层放批量件展示卡：一张圆角白底展示卡，卡片中上部按真实数量整齐排列 ")
              .append(filters).append(" 支滤芯，").append(cardSpec)
              .append("横幅内标明滤芯数量信息。");
        }
        sb.append("配件/批量件的样式、结构、颜色、细节严格参考对应的配件白底图、与白底图一致、不改色。")
          .append(cups);
        return sb.toString();
    }

    /** 数字 1-20 转英文单词，用于 prompt 双重约束（数字+文字） */
    private static String numberToWords(int n) {
        String[] words = {"zero","one","two","three","four","five","six","seven",
                          "eight","nine","ten","eleven","twelve","thirteen","fourteen",
                          "fifteen","sixteen","seventeen","eighteen","nineteen","twenty"};
        return n >= 0 && n < words.length ? words[n] : String.valueOf(n);
    }

    /** 按配置构建 HTTP 客户端（可选代理）。 */
    private OkHttpClient buildHttp() {
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
    private OkHttpClient buildHttpNoProxy() {
        return new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .readTimeout(300, TimeUnit.SECONDS)
            .build();
    }

    /** 生图输出目录：用户数据目录下 sku-gen/<batch>/ */
    private File outputDir(String batch) {
        File dir = new File(appProperties.getPaths().getUserDataDir(), "sku-gen/" + batch);
        dir.mkdirs();
        return dir;
    }

    /** 人像参考图：从 classpath assets/portrait.png 落地到用户目录一次，返回文件。失败返回 null。 */
    private File portraitRefFile() {
        try {
            File f = new File(appProperties.getPaths().getUserDataDir(), "assets/portrait.png");
            if (f.isFile()) return f;
            f.getParentFile().mkdirs();
            try (java.io.InputStream is = getClass().getClassLoader().getResourceAsStream("assets/portrait.png")) {
                if (is == null) return null;
                Files.write(f.toPath(), is.readAllBytes());
            }
            return f;
        } catch (Exception e) { log.warn("人像参考图落地失败: {}", e.getMessage()); return null; }
    }

    /**
     * 解码 b64 图片，缩放到最长边 ≤1024，转 JPG 保存（quality 0.9），返回输出文件。
     * 拼多多对单图尺寸/体积有限制，2K PNG 偏大易上传失败，故统一压成 1024 JPG。
     */
    private File saveAsJpg(String b64, String batch, int seq, String skuName) throws Exception {
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

    /**
     * 以 refImagePath 为参考，为某个 SKU 生成一张展示图，保存到 outputDir，返回绝对路径。
     * 失败抛异常。
     */
    public String generateSkuImage(String refImagePath, String skuName, String compDesc,
                                   String productType, String batch, int seq, String bagImagePath,
                                   String whiteImgPath, List<String> accImagePaths,
                                   String waterImagePath, String bgStyleOverride, String itemCode,
                                   List<Map<String, Object>> accParts, String templateId) throws Exception {
        AppProperties.GptImage cfg = appProperties.getGptImage();
        List<String> keys = cfg.keyList();
        if (keys.isEmpty()) throw new RuntimeException("生图密钥未配置");
        String baseUrl = cfg.getBaseUrl();
        String model   = cfg.getModel();
        boolean gemini = "gemini".equalsIgnoreCase(cfg.getProvider());
        boolean openai = "openai".equalsIgnoreCase(cfg.getProvider());
        boolean isShower = productType != null && (productType.contains("花洒") || productType.contains("淋浴"));

        // 纯颜色名：从 skuName 取首段（去【】后，遇 - / 空格 截断），用于左上色标等「只写颜色」处。
        // 如「雅黑色-亲肤按摩 单品」→「雅黑色」、「【月光银】增压」→「月光银」。
        String colorOnly = colorOf(skuName);

        // 防比价模板：templateId 指定则按它决定构图；sticker/空=贴图(现有逻辑)，ai=整图AI生成。
        Map<String, Object> tpl = (templateId != null && !templateId.isBlank())
            ? templateService.findById(templateId) : null;
        boolean aiTemplate = tpl != null && "ai".equalsIgnoreCase(String.valueOf(tpl.get("type")));
        boolean stickerMode = !aiTemplate;  // 非 ai 模板（含默认/sticker）都走贴图合成
        String cacheBaseForTemplate = null;  // 非空＝本次生成的图要缓存为该模板的基准图

        int filterCount = parseFilterCount(compDesc);
        String filterConstraint = filterCount > 0
            ? "ABSOLUTE FILTER COUNT: exactly " + filterCount + " (" + numberToWords(filterCount) + ") "
              + "white sleek cylindrical filter sticks. "
              + "These are plain matte white tubes — NO holes, NO handle, NO black rubber, "
              + "NO water-outlet pattern, NO surface details from the main product. "
              + "Count them: there must be exactly " + filterCount + " on the left side. "
            : "";

        String skuPromptTemplate = PromptLoader.load("prompt/image-sku-white-bg.txt");
        String prompt = skuPromptTemplate
            .replace("{{productType}}",  productType == null ? "Shower Head" : productType)
            .replace("{{skuName}}",      skuName)
            .replace("{{compDesc}}",     compDesc == null || compDesc.isBlank() ? "no accessories" : compDesc)
            .replace("{{filterConstraint}}", filterConstraint);

        File ref = new File(refImagePath);
        boolean hasRef = ref.isFile();
        // 白底产品图：SKU 白底路径用它作视觉参考（干净、无文字水印），回退到营销参考图
        File whiteBgRef = (whiteImgPath != null && !whiteImgPath.isBlank())
            ? new File(whiteImgPath) : ref;
        boolean hasWhiteBg = whiteBgRef.isFile();
        File bag = (bagImagePath != null && !bagImagePath.isBlank()) ? new File(bagImagePath) : null;
        boolean hasBag = bag != null && bag.isFile();
        // 配件白底图筛选：优先用前面【已选的配件清单 accParts】（每项 code+qty）精确匹配白底图文件名——
        // 这是用户在搭配阶段明确选的配件，最可靠。accParts 为空时回退到 itemCode 配件码 / 中文关键字。
        boolean needHose = hasHose(compDesc);
        boolean needBase = hasBase(compDesc);
        boolean needFilter = filterCountFor(compDesc) > 0;
        // 候选白底图（已由前端排除袋子/水质/主件色图）
        java.util.List<File> candFiles = new java.util.ArrayList<>();
        if (accImagePaths != null) {
            for (String p : accImagePaths) {
                if (p == null || p.isBlank()) continue;
                File f = new File(p);
                if (f.isFile()) candFiles.add(f);
            }
        }
        List<File> accFiles = new java.util.ArrayList<>();
        java.util.List<String> accLabels = new java.util.ArrayList<>();  // 与 accFiles 对应：每张配件图的中文身份
        int filterQtyFromParts = 0;  // 从已选配件清单里拿到的滤芯数量
        boolean usedParts = false;
        java.util.Set<String> usedFiles = new java.util.HashSet<>();  // 已用白底图，避免一张图被多个 part 重复命中
        // 展开组合套装码：有的 part 的 code 是一长串组合码（如「027黑单手喷+银底座+银色2米软管+001滤芯*5」），
        // 需拆成多个原子配件，各自带关键字与数量，否则只会按整串匹配 → 漏配底座/软管。
        java.util.List<Map<String, Object>> flatParts = new java.util.ArrayList<>();
        if (accParts != null) {
            for (Map<String, Object> part : accParts) {
                String code = String.valueOf(part.getOrDefault("code", "")).trim();
                String pkw = String.valueOf(part.getOrDefault("kw", "")).trim();
                int pqty = 1;
                try { pqty = Math.max(1, Integer.parseInt(String.valueOf(part.getOrDefault("qty", 1)))); } catch (Exception ignore) {}
                if (code.contains("+")) {
                    // 组合码：按 + 拆段，跳过首段（主件），每段解析 *N 数量 + 关键字
                    String[] segs = code.split("\\+");
                    for (int i = 1; i < segs.length; i++) {
                        String seg = segs[i].trim();
                        if (seg.isEmpty()) continue;
                        int segQty = 1;
                        int star = seg.indexOf('*');
                        if (star >= 0) {
                            try { segQty = Math.max(1, Integer.parseInt(seg.substring(star + 1).replaceAll("[^0-9]", ""))); } catch (Exception ignore) {}
                            seg = seg.substring(0, star).trim();
                        }
                        String segKw = seg.contains("软管") ? "软管" : seg.contains("滤芯") ? "滤芯"
                                     : (seg.contains("底座") || seg.contains("支架") || seg.contains("挂座")) ? "底座" : "";
                        Map<String, Object> fp = new java.util.HashMap<>();
                        fp.put("code", seg); fp.put("qty", segQty); fp.put("kw", segKw);
                        flatParts.add(fp);
                    }
                } else {
                    Map<String, Object> fp = new java.util.HashMap<>();
                    fp.put("code", code); fp.put("qty", pqty); fp.put("kw", pkw);
                    flatParts.add(fp);
                }
            }
        }
        if (!flatParts.isEmpty()) {
            for (Map<String, Object> part : flatParts) {
                String code = String.valueOf(part.getOrDefault("code", "")).trim();
                if (code.isEmpty()) continue;
                int qty = 1;
                try { qty = Math.max(1, Integer.parseInt(String.valueOf(part.getOrDefault("qty", 1)))); } catch (Exception ignore) {}
                // 关键字：前端传的 kw 优先；没传则从 code 推断（软管/滤芯/底座）
                String kw = String.valueOf(part.getOrDefault("kw", "")).trim();
                if (kw.isEmpty()) {
                    if (code.contains("软管") || code.toLowerCase().contains("hose")) kw = "软管";
                    else if (code.contains("滤芯") || code.toLowerCase().contains("filter")) kw = "滤芯";
                    else if (code.contains("底座") || code.toLowerCase().contains("base")) kw = "底座";
                }
                File hit = null;
                // 1) kw 优先：白底图按「软管/底座/滤芯」命名，按关键字精确配，最可靠
                if (!kw.isEmpty()) {
                    for (File f : candFiles) {
                        if (usedFiles.contains(f.getPath())) continue;
                        if (f.getName().contains(kw)) { hit = f; break; }
                    }
                }
                // 2) kw 没配上→退回按 ERP 配件码匹配文件名
                if (hit == null) {
                    for (File f : candFiles) {
                        if (usedFiles.contains(f.getPath())) continue;
                        String nmNoExt = f.getName().replaceAll("\\.[^.]+$", "");
                        if (nmNoExt.contains(code) || code.contains(nmNoExt)) { hit = f; break; }
                    }
                }
                if (hit == null) continue;
                usedFiles.add(hit.getPath());
                usedParts = true;
                String nm = hit.getName();
                String label = nm.contains("软管") || nm.toLowerCase().contains("hose") ? "软管"
                             : nm.contains("滤芯") || nm.toLowerCase().contains("filter") ? "滤芯"
                             : nm.contains("底座") || nm.toLowerCase().contains("base") ? "底座" : "配件";
                if ("滤芯".equals(label)) filterQtyFromParts = Math.max(filterQtyFromParts, qty);
                accFiles.add(hit);
                accLabels.add(label);
            }
        }
        // 回退：accParts 没命中任何图时，用旧的 itemCode 配件码 / 中文关键字匹配
        if (!usedParts) {
            java.util.List<String> accCodes = new java.util.ArrayList<>();
            if (itemCode != null && !itemCode.isBlank() && itemCode.contains("+")) {
                String[] segs = itemCode.split("\\+");
                for (int i = 1; i < segs.length; i++) {
                    String code = segs[i].split("\\*")[0].trim();
                    if (!code.isEmpty()) accCodes.add(code);
                }
            }
            boolean byCode = !accCodes.isEmpty();
            for (File f : candFiles) {
                String nm = f.getName();
                String nmNoExt = nm.replaceAll("\\.[^.]+$", "");
                boolean keep;
                if (byCode) {
                    keep = accCodes.stream().anyMatch(nmNoExt::contains);
                } else {
                    boolean isHose = nm.contains("软管") || nm.toLowerCase().contains("hose");
                    boolean isFilter = nm.contains("滤芯") || nm.toLowerCase().contains("filter");
                    boolean isBase = nm.contains("底座") || nm.toLowerCase().contains("base");
                    keep = (isHose && needHose) || (isFilter && needFilter) || (isBase && needBase);
                }
                if (keep) {
                    accFiles.add(f);
                    String label = nm.contains("软管") || nm.toLowerCase().contains("hose") ? "软管"
                                 : nm.contains("滤芯") || nm.toLowerCase().contains("filter") ? "滤芯"
                                 : nm.contains("底座") || nm.toLowerCase().contains("base") ? "底座" : "配件";
                    accLabels.add(label);
                }
            }
        }
        // 滤芯展示数量：优先用已选配件清单里的滤芯 qty，没有再用款式名解析值
        int filterShow = filterQtyFromParts > 0 ? filterQtyFromParts : filterCount;
        OkHttpClient http = buildHttp();

        // 两阶段：先用视觉模型分析白底主件图，提取真实材质/颜色/结构，注入生图 prompt
        String refAnalysis = "";
        if (gemini && hasWhiteBg) {
            try {
                String a = analyzeRefImage(http, baseUrl, keys.get(0), whiteBgRef,
                                           skuName, productType, compDesc);
                if (a != null && !a.isBlank()) refAnalysis = a;
            } catch (Exception e) { log.warn("SKU 主件分析失败，降级无分析生图: {}", e.getMessage()); }
        }

        // ── openai + 花洒 sticker 贴图模式：AI 生右侧主件+背景，左侧由 Java 合成贴图。
        //    （ai 模板不走这里，落到下方统一路径，享受基准图复用/img2img/配件卡/通栏等完整逻辑）──
        if (openai && isShower && stickerMode) {
            String bgStyle = "clean light gray studio backdrop, soft diffused lighting";
            String showerTemplate = PromptLoader.load("prompt/image-shower-main.txt");
            prompt = showerTemplate
                .replace("{{bgStyle}}",   bgStyle)
                .replace("{{colorName}}", colorOnly);

            // 参考图：本色花洒白底图 + 袋子（配件/水质不传给 AI，左侧由合成贴图）
            List<File> showerRefs = new java.util.ArrayList<>();
            if (hasWhiteBg) showerRefs.add(whiteBgRef);
            if (hasBag) showerRefs.add(bag);

            // 一次生成
            Exception lastShower = null;
            for (int attempt = 0; attempt < keys.size(); attempt++) {
                String key = keys.get(Math.abs(keyCursor.getAndIncrement()) % keys.size());
                try {
                    String b64 = showerRefs.isEmpty()
                        ? callGptImage2TextOnly(http, baseUrl, key, model, prompt)
                        : callGptImage2(http, baseUrl, key, model, prompt, showerRefs);
                    File out = saveAsJpg(b64, batch, seq, skuName);
                    try {
                        out = compositeShowerLeft(out, accFiles, accLabels, filterShow, batch, seq, skuName, compDesc, hasRef ? ref : null);
                    } catch (Exception ce) {
                        log.warn("花洒左侧合成失败，返回纯主图: {}", ce.getMessage());
                    }
                    return out.getAbsolutePath();
                } catch (Exception e) {
                    lastShower = e;
                    log.warn("花洒主图失败(密钥{}): {}", attempt, e.getMessage());
                }
            }
            throw new RuntimeException("花洒主图生成失败: " + (lastShower != null ? lastShower.getMessage() : "未知"));
        }

        // 参考图列表
        List<File> refs = new java.util.ArrayList<>();
        if (hasRef) refs.add(ref);

        // SKU 白底图：Flash 只提取参考图背景风格，不碰产品描述
        String bgDesc = "";
        if (!isShower) {
            if (bgStyleOverride != null && !bgStyleOverride.isBlank()) {
                bgDesc = bgStyleOverride;  // 同批共享的背景描述，优先
            } else if (gemini && hasRef) {
                try {
                    bgDesc = analyzeBackgroundStyle(http, baseUrl, keys.get(0), ref);
                } catch (Exception e) { log.warn("SKU 背景提取失败: {}", e.getMessage()); }
            }
        }

        // 防比价模板：见方法上方已解析的 tpl / aiTemplate / stickerMode

        if (isShower) {
            // 花洒专属固定构图模板
            String bgStyle = "纯白或浅色简约影棚背景";
            if (bgStyleOverride != null && !bgStyleOverride.isBlank()) {
                bgStyle = bgStyleOverride;  // 同批共享的背景描述，优先
            } else if (gemini && hasRef) {
                try {
                    String bg = analyzeBackgroundStyle(http, baseUrl, keys.get(0), ref);
                    if (bg != null && !bg.isBlank()) bgStyle = bg;
                } catch (Exception e) { log.warn("背景风格提取失败: {}", e.getMessage()); }
            }
            if (aiTemplate) {
                // 纯AI模板：基准图复用 + 图生图替换。有基准图→以它为底只换花洒/滤芯/背景；无→用 prompt 生成首张并缓存为基准。
                String colorNm = colorOnly;
                String accInfo = buildAccInfo(accFiles, accLabels, filterShow);
                // 按该 SKU 是否有配件，选「-有配件/-无配件」基准图变体
                boolean hasAcc = !accFiles.isEmpty();
                File baseImg = templateService.resolveBaseImg(tpl, hasAcc);
                refs.clear();
                if (baseImg != null && baseImg.isFile()) {
                    // 图生图：基准图打底（放第一张，权重最高）+ 本色花洒白底图 +（拆解类）滤芯 +（瀑布类）主图背景
                    String edit = String.valueOf(tpl.getOrDefault("editInstruction", tpl.getOrDefault("prompt", "")));
                    prompt = edit.replace("{{colorName}}", colorNm)
                                 .replace("{{bgStyle}}", bgStyle)
                                 .replace("{{accInfo}}", accInfo);
                    refs.add(baseImg);
                    if (hasWhiteBg) refs.add(whiteBgRef);
                    // 精简参考图：只喂滤芯白底图（装柄用），底座/软管不喂 AI（它们只用于 Java 贴配件卡），避免多图拖慢/超时
                    for (int k = 0; k < accFiles.size(); k++) if ("滤芯".equals(accLabels.get(k))) { refs.add(accFiles.get(k)); break; }
                    if (Boolean.TRUE.equals(tpl.get("useExplodeRef"))) {
                        File er = templateService.explodeRefFile();
                        if (er != null && er.isFile()) refs.add(er);  // 拆解结构参考，锁内部结构
                    }
                    if (Boolean.TRUE.equals(tpl.get("useMainBg")) && hasRef) refs.add(ref);
                    if (Boolean.TRUE.equals(tpl.get("usePortraitImg"))) {
                        File portrait = portraitRefFile();
                        if (portrait != null && portrait.isFile()) refs.add(portrait);
                    }
                } else {
                    // 无基准图：用 prompt 整图生成，生成后缓存为该模板基准图（供后续 SKU 复用）
                    String tplPrompt = String.valueOf(tpl.getOrDefault("prompt", ""));
                    prompt = tplPrompt.replace("{{bgStyle}}", bgStyle)
                                      .replace("{{colorName}}", colorNm)
                                      .replace("{{accInfo}}", accInfo);
                    if (hasWhiteBg) refs.add(whiteBgRef);
                    if (hasRef) refs.add(ref);
                    if (Boolean.TRUE.equals(tpl.get("usePortraitImg"))) {
                        File portrait = portraitRefFile();
                        if (portrait != null && portrait.isFile()) refs.add(portrait);
                    }
                    cacheBaseForTemplate = String.valueOf(tpl.get("id"));  // 标记：生成后缓存为基准
                }
                // 全 ai 模板共享的「花洒保真 + 防误配件」强约束（防止：花洒被换成别的样子、主体上乱接软管/底座、把花洒/喷头/手柄当配件另摆）
                prompt = prompt + "\n\n【产品一致性·强约束】"
                    + "花洒主体的外形、轮廓、比例、喷头面板孔位、手柄结构、颜色、材质必须严格复刻所给本色花洒白底图，禁止美化、禁止改变结构与配色；"
                    + "花洒主体上不得连接软管、底座或任何额外配件；"
                    + "不得把花洒、花洒喷头、花洒手柄当作配件重复出现或单独摆放；"
                    + "画面中除指定构图外不得新增任何产品或配件。";
            } else {
                String showerTemplate = PromptLoader.load("prompt/image-shower-main.txt");
                prompt = showerTemplate
                    .replace("{{bgStyle}}",   bgStyle)
                    .replace("{{colorName}}", colorOnly);
                // AI 只画右侧主件+背景，左侧配件由 Java 合成贴图。
                // 参考图：本色花洒白底图（锁颜色/样式）+ 袋子图 + 主图（背景参考）。配件/水质图不传给 AI。
                refs.clear();
                if (hasWhiteBg) refs.add(whiteBgRef);
                if (hasBag) refs.add(bag);
                if (hasRef) refs.add(ref);
            }
        }

        // SKU 白底图：填充主件分析结果占位符 + 追加背景描述到 prompt
        if (!isShower) {
            prompt = prompt.replace("{{refAnalysis}}", refAnalysis);
            if (gemini && !bgDesc.isBlank()) {
                prompt = prompt + "\n\n[BACKGROUND]: " + bgDesc;
            }
        }

        // 生图用图：花洒主图用 refs（营销参考图+袋子），SKU 白底图用白底产品图
        List<File> genRefs = new java.util.ArrayList<>();
        if (isShower) {
            genRefs.addAll(refs);  // 花洒：refs = 营销参考图 + 袋子图
        } else if (hasWhiteBg) {
            genRefs.add(whiteBgRef);  // SKU 白底：只用白底产品图
        } else if (hasRef) {
            genRefs.add(ref);  // SKU 无白底图时回退
        }

        // 轮换密钥，失败换下一个
        Exception last = null;
        for (int attempt = 0; attempt < keys.size(); attempt++) {
            String key = keys.get(Math.abs(keyCursor.getAndIncrement()) % keys.size());
            try {
                // 诊断耗时：记录 API 调用开始/结束，用于判断是「单张本身慢」还是「中转站限并发被串行」
                long _t0 = System.nanoTime();
                log.info("[生图计时] seq={} 第{}图 开始调用 (线程={}, 参考图{}张)", seq, seq, Thread.currentThread().getName(), genRefs.size());
                String b64;
                if (openai) {
                    b64 = genRefs.isEmpty()
                        ? callGptImage2TextOnly(http, baseUrl, key, model, prompt)
                        : callGptImage2(http, baseUrl, key, model, prompt, genRefs);
                } else {
                    b64 = callGemini(http, baseUrl, key, model, prompt, genRefs);
                }
                log.info("[生图计时] seq={} API 返回, 耗时 {}s", seq, String.format("%.1f", (System.nanoTime() - _t0) / 1e9));
                File out = saveAsJpg(b64, batch, seq, skuName);
                // 花洒贴图模式：AI 只生右侧主件+背景，左侧配件/批量件/水质对比由 Java 合成贴图。
                // 纯AI模板（aiTemplate）整图由 AI 生成，不贴图。
                if (isShower && stickerMode) {
                    try {
                        out = compositeShowerLeft(out, accFiles, accLabels, filterShow, batch, seq, skuName, compDesc, hasRef ? ref : null);
                    } catch (Exception ce) {
                        log.warn("花洒左侧合成失败，返回纯主图: {}", ce.getMessage());
                    }
                }
                // 纯AI模板带 accCardRegion / bottomBanner：img2img 出图后，Java 在指定区域贴配件卡/底部通栏（确定性）
                if (isShower && aiTemplate) {
                    Object region = tpl.get("accCardRegion");
                    boolean bottomBanner = Boolean.TRUE.equals(tpl.get("bottomBanner"));
                    String regionStr = region instanceof String ? (String) region : "";
                    String bannerRight = String.valueOf(tpl.getOrDefault("bannerRight", ""));
                    if (!regionStr.isBlank() || bottomBanner) {
                        try {
                            out = compositeAccCardAt(out, regionStr, accFiles, accLabels, filterShow,
                                                     bottomBanner, skuName, bannerRight, batch, seq, skuName, hasRef ? ref : null);
                        } catch (Exception ce) {
                            log.warn("配件卡/底部通栏合成失败，返回纯AI图: {}", ce.getMessage());
                        }
                    }
                }
                // 纯AI模板无基准图时，把这张生成图缓存为该模板基准图，供同模板后续 SKU 图生图复用
                if (cacheBaseForTemplate != null) {
                    try { templateService.saveBaseCache(cacheBaseForTemplate, out); } catch (Exception ce) { log.warn("基准图缓存失败: {}", ce.getMessage()); }
                }
                return out.getAbsolutePath();
            } catch (Exception e) {
                last = e;
                log.warn("生图失败(密钥{}): {}", attempt, e.getMessage());
            }
        }
        throw new RuntimeException("生图失败：" + (last != null ? last.getMessage() : "未知"));
    }

    /**
     * 公开入口：对一张主图分析背景风格，返回简短中文描述。
     * 供控制器对同批 SKU 只分析一次、全批共享同一背景。失败返回空串（不抛）。
     */
    public String analyzeBackgroundStyleOnce(String refImagePath) {
        try {
            AppProperties.GptImage cfg = appProperties.getGptImage();
            if (!"gemini".equalsIgnoreCase(cfg.getProvider())) return "";
            List<String> keys = cfg.keyList();
            if (keys.isEmpty()) return "";
            File ref = new File(refImagePath);
            if (!ref.isFile()) return "";
            String bg = analyzeBackgroundStyle(buildHttp(), cfg.getBaseUrl(), keys.get(0), ref);
            return bg == null ? "" : bg.trim();
        } catch (Exception e) {
            log.warn("批量背景分析失败: {}", e.getMessage());
            return "";
        }
    }

    /** 只提取参考图的背景风格（颜色/材质/光感），返回简短中文描述。 */
    @SuppressWarnings("unchecked")
    private String analyzeBackgroundStyle(OkHttpClient http, String baseUrl, String key, File ref) throws Exception {
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
    private String analyzeRefImage(OkHttpClient http, String baseUrl, String key, File ref,
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
    private String callGemini(OkHttpClient http, String baseUrl, String key, String model,
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

    /** 执行请求，从响应 data[0] 取 b64_json；若只给 url 则下载转 b64。 */
    @SuppressWarnings("unchecked")
    private String extractB64(OkHttpClient http, Request req) throws Exception {
        try (Response resp = http.newCall(req).execute()) {
            String body = resp.body() != null ? resp.body().string() : "";
            if (!resp.isSuccessful()) throw new RuntimeException("HTTP " + resp.code() + ": " + body);
            Map<String, Object> m = objectMapper.readValue(body, Map.class);
            List<Map<String, Object>> data = (List<Map<String, Object>>) m.get("data");
            if (data == null || data.isEmpty()) throw new RuntimeException("无图片返回: " + body);
            Map<String, Object> first = data.get(0);
            Object b64 = first.get("b64_json");
            if (b64 instanceof String && !((String) b64).isBlank()) return (String) b64;
            Object url = first.get("url");
            if (url instanceof String && !((String) url).isBlank()) {
                Request dl = new Request.Builder().url((String) url).get().build();
                try (Response r2 = http.newCall(dl).execute()) {
                    if (!r2.isSuccessful() || r2.body() == null) throw new RuntimeException("下载图片失败");
                    return Base64.getEncoder().encodeToString(r2.body().bytes());
                }
            }
            throw new RuntimeException("响应无 b64_json/url: " + body);
        }
    }

    /** gpt-image-2 图生图/文生图。与 ele-business-java GptImageAgent 完全一致的 multipart form 调用。返回 b64。 */
    @SuppressWarnings("unchecked")
    private String callGptImage2(OkHttpClient http, String baseUrl, String key, String model,
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
    private String callGptImage2TextOnly(OkHttpClient http, String baseUrl, String key,
                                         String model, String prompt) throws Exception {
        return callGptImage2(http, baseUrl, key, model, prompt, java.util.List.of());
    }

    private String mimeOf(File f) {
        String n = f.getName().toLowerCase();
        return n.endsWith(".png") ? "image/png" : n.endsWith(".webp") ? "image/webp" : "image/jpeg";
    }

    /**
     * 文本/多模态生成：返回纯文本。供标题/款式名生成复用。
     * 走 app.text 配置（默认阿里云百炼 DashScope，OpenAI 兼容 chat/completions，qwen-vl-plus）。
     * imagePaths 为空则纯文本；否则把图片作为 image_url(data URI) 一起传（最多3张）。
     * 方法名保留 geminiText 以兼容现有调用方。
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

    /**
     * 花洒专属：AI 只生右侧主件+背景，左侧由本方法用白底图合成贴上。
     * 左中=一张配件卡（底座/软管/滤芯横排同卡内，底条写全部名称）；底部=全宽深色通栏写款式名。
     * 失败抛异常，由调用方降级为纯主图。
     */
    private File compositeShowerLeft(File baseImg, List<File> accFiles, List<String> accLabels,
                                     int filterCount, String batch, int seq, String skuName, String compDesc, File bgRef) throws Exception {
        BufferedImage base = ImageIO.read(baseImg);
        if (base == null) throw new RuntimeException("合成读图失败");
        int W = base.getWidth(), H = base.getHeight();
        Graphics2D g = base.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

        // 底条/通栏颜色：优先从主图采样（保证整批与主图统一），主图不可用才退回从生成图采样
        Color bgBase = bgColor(bgRef, base);
        Color banner = darken(bgBase, 0.6);

        // 所有配件合并进一张卡：底座/软管各一格，滤芯按数量重复；底条写全部名称
        java.util.List<File>   showImgs = new java.util.ArrayList<>();
        java.util.List<String> txts     = new java.util.ArrayList<>();
        File filterImg = null;
        for (int i = 0; i < accFiles.size(); i++) {
            String lb = accLabels.get(i);
            if ("滤芯".equals(lb)) { filterImg = accFiles.get(i); }
            else { showImgs.add(accFiles.get(i)); txts.add(accDisplay(accFiles.get(i), lb, 0)); }
        }
        boolean hasFilter = filterImg != null && filterCount > 0;
        if (hasFilter) { for (int i = 0; i < filterCount; i++) showImgs.add(filterImg); txts.add(filterDisplay(filterCount)); }
        boolean hasCard = !showImgs.isEmpty();

        if (hasCard) {
            // 左中一张横向卡（4:3，宽>高），垂直居中，左侧留边、与右侧袋子保持间距
            int cardW = (int)(W * 0.38);
            int cardH = (int)(cardW * 3.0 / 4.0);
            int cardX = (int)(W * 0.06);
            int cardY = (H - cardH) / 2;
            drawAccCard(g, cardX, cardY, cardW, cardH, showImgs, String.join(" / ", txts), 0, banner);
        }

        // 底部全宽深色通栏：写款式名（如「一键止水花洒+1.5米软管」）
        String bottomTxt = compDesc == null ? "" : compDesc.trim();
        if (!bottomTxt.isBlank()) {
            int bh = (int)(H * 0.10);
            int by = H - bh;
            g.setColor(darken(bgBase, 0.45));
            g.fillRect(0, by, W, bh);
            drawFitText(g, bottomTxt, (int)(W * 0.04), by, (int)(W * 0.92), bh, 52, Color.WHITE);
        }

        g.dispose();
        return writeJpg(base, batch, seq, skuName);
    }

    /** 颜色按因子加深（f<1 变暗）。 */
    private static Color darken(Color c, double f) {
        return new Color((int)(c.getRed()*f), (int)(c.getGreen()*f), (int)(c.getBlue()*f));
    }

    /**
     * 在 AI 出图上做确定性合成：可选配件卡（region 指定位置）+ 可选底部胶囊通栏。
     * 配件(底座/软管)+滤芯合并进同一张卡：上半区横排展示，下半区底条写「银底座 / n米银色软管 / 滤芯*N」。
     * region 支持 "right-center" / "left-bottom" / "center"。bottomBanner=true 时画底部通栏（左 bannerLeft、右 bannerRight）。
     */
    private File compositeAccCardAt(File baseImg, String region, List<File> accFiles, List<String> accLabels,
                                    int filterCount, boolean bottomBanner, String bannerLeft, String bannerRight,
                                    String batch, int seq, String skuName, File bgRef) throws Exception {
        java.util.List<File>   items  = new java.util.ArrayList<>();
        java.util.List<String> labels = new java.util.ArrayList<>();
        File filterImg = null;
        for (int i = 0; i < accFiles.size(); i++) {
            if ("滤芯".equals(accLabels.get(i))) filterImg = accFiles.get(i);
            else { items.add(accFiles.get(i)); labels.add(accLabels.get(i)); }
        }
        boolean hasFilter = filterImg != null && filterCount > 0;
        boolean drawCard = !region.isBlank() && (!items.isEmpty() || hasFilter);
        if (!drawCard && !bottomBanner) return baseImg;  // 无事可做

        BufferedImage base = ImageIO.read(baseImg);
        if (base == null) throw new RuntimeException("配件卡合成读图失败");
        int W = base.getWidth(), H = base.getHeight();
        Graphics2D g = base.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

        // 底条颜色统一从主图采样（整批一致），主图不可用退回生成图
        Color banner = darken(bgColor(bgRef, base), 0.6);

        if (drawCard) {
            // 横向展示卡（宽 > 高，4:3）；位置按 region 决定
            int cardW = (int)(W * 0.38);
            int cardH = (int)(cardW * 3.0 / 4.0);
            int cx, cy;
            // 底部通栏占底部约 12%，卡底锚定在通栏上方留 2% 间隙
            int cardBottom = (int)(H * 0.86);
            // 顶部安全线：左上文字带约占顶部 33%，卡顶不得越过此线（1024 下约 y=340）
            int topSafe = (int)(H * 0.34);
            if ("left-bottom".equals(region)) {
                cx = (int)(W * 0.05); cy = cardBottom - cardH;
            } else if ("left-mid-bottom".equals(region)) {
                cx = (int)(W * 0.05); cy = cardBottom - cardH;
            } else if ("center".equals(region)) {
                cx = (W - cardW) / 2; cy = (H - cardH) / 2;
            } else { // right-center：右侧中部偏上（避开右下人像、落在顶部文字下方）
                cx = (int)(W * 0.56); cy = (int)(H * 0.30);
            }
            // 卡顶越过安全线则压缩卡高、保持卡底不动，确保不挡上方文字
            if (cy < topSafe) {
                cy = topSafe;
                cardH = cardBottom - topSafe;
                cardW = (int)(cardH * 4.0 / 3.0);
            }
            java.util.List<String> txts = new java.util.ArrayList<>();
            for (int i = 0; i < items.size(); i++) txts.add(accDisplay(items.get(i), labels.get(i), 0));
            if (hasFilter) txts.add(filterDisplay(filterCount));
            java.util.List<File> drawImgs = new java.util.ArrayList<>(items);
            if (hasFilter) for (int i = 0; i < filterCount; i++) drawImgs.add(filterImg);
            drawAccCard(g, cx, cy, cardW, cardH, drawImgs, String.join(" / ", txts), 0, banner);
        }

        if (bottomBanner) {
            drawBottomBanner(g, base, bannerLeft == null ? "" : bannerLeft,
                             bannerRight == null ? "" : bannerRight);
        }

        g.dispose();
        return writeJpg(base, batch, seq, skuName);
    }

    /**
     * 底部胶囊通栏：横跨底部，左右两色块拼接。左块加深背景色写 leftTxt、右块浅背景色写 rightTxt。
     * 文字用 drawFitText 约束在各自半区内，不超框、留缝隙。
     */
    private void drawBottomBanner(Graphics2D g, BufferedImage base, String leftTxt, String rightTxt) {
        int W = base.getWidth(), H = base.getHeight();
        int bh = (int)(H * 0.10);
        int by = H - bh - (int)(H * 0.03);
        int bx = (int)(W * 0.04), bw = W - bx * 2;
        int arc = bh;  // 两端大圆角胶囊
        int mid = bx + (int)(bw * 0.42);
        Color baseBg = sampleBgColorAt(base, 0.50);
        Color leftC  = darken(baseBg, 0.55);
        Color rightC = baseBg;
        // 左半（含左端圆角）
        g.setColor(leftC);
        g.fillRoundRect(bx, by, mid - bx + arc, bh, arc, arc);
        // 右半（含右端圆角）
        g.setColor(rightC);
        g.fillRoundRect(mid - arc, by, bx + bw - mid + arc, bh, arc, arc);
        // 文字（白色，各自半区内自适应）
        drawFitText(g, leftTxt,  bx, by, mid - bx, bh, 56, Color.WHITE);
        drawFitText(g, rightTxt, mid, by, bx + bw - mid, bh, 56, Color.WHITE);
    }

    /** 在指定横向比例处采样背景色（避开主体）。fx∈[0,1]。 */
    private Color sampleBgColorAt(BufferedImage img, double fx) {
        int W = img.getWidth(), H = img.getHeight();
        long r = 0, gg = 0, b = 0; int n = 0;
        int x = Math.min(W - 1, Math.max(0, (int)(W * fx)));
        for (double fy : new double[]{0.10, 0.22, 0.35}) {
            int rgb = img.getRGB(x, (int)(H * fy));
            r += (rgb >> 16) & 0xFF; gg += (rgb >> 8) & 0xFF; b += rgb & 0xFF; n++;
        }
        if (n == 0) return new Color(60, 80, 120);
        return new Color((int)(r / n), (int)(gg / n), (int)(b / n));
    }

    /** 底条/通栏代表色：优先从主图（bgRef）四角采样取均值，主图不可用则退回从生成图采样。整批用同一主图→颜色统一。 */
    private Color bgColor(File bgRef, BufferedImage fallback) {
        if (bgRef != null && bgRef.isFile()) {
            try {
                BufferedImage m = ImageIO.read(bgRef);
                if (m != null) {
                    int W = m.getWidth(), H = m.getHeight();
                    long r = 0, gg = 0, b = 0; int n = 0;
                    int[][] pts = {{(int)(W*0.06),(int)(H*0.10)},{(int)(W*0.94),(int)(H*0.10)},
                                   {(int)(W*0.06),(int)(H*0.90)},{(int)(W*0.94),(int)(H*0.90)},
                                   {(int)(W*0.5),(int)(H*0.5)}};
                    for (int[] p : pts) { int rgb = m.getRGB(p[0], p[1]); r+=(rgb>>16)&0xFF; gg+=(rgb>>8)&0xFF; b+=rgb&0xFF; n++; }
                    return new Color((int)(r/n), (int)(gg/n), (int)(b/n));
                }
            } catch (Exception ignore) {}
        }
        return sampleBgColor(fallback);
    }

    /** 单个配件→规范中文名：底座=银底座、软管=n米软管（米数取文件名）、滤芯=过滤滤芯*N。 */
    private static String accDisplay(File f, String label, int count) {
        String nm = f.getName().replaceAll("\\.[^.]+$", "");
        if ("滤芯".equals(label)) return "过滤滤芯*" + count;
        if ("软管".equals(label)) {
            String m = nm.contains("2米") ? "2" : (nm.contains("1.5") ? "1.5" : "");
            return (m.isEmpty() ? "" : m + "米") + "软管";
        }
        if ("底座".equals(label)) return "银底座";
        return label;
    }

    /** 滤芯卡底条文案：过滤滤芯*N。 */
    private static String filterDisplay(int count) { return "过滤滤芯*" + count; }

    /**
     * 从 SKU 名提取纯颜色名：优先取【】中括号内容；否则取首段（遇 - / 空格 / + 截断）。
     * 如「雅黑色-亲肤按摩 单品」→「雅黑色」、「【月光银】增压过滤」→「月光银」、「枪灰 一键止水」→「枪灰」。
     */
    private static String colorOf(String skuName) {
        if (skuName == null) return "";
        String s = skuName.trim();
        if (s.isEmpty()) return "";
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("[【\\[]([^】\\]]+)[】\\]]").matcher(s);
        if (m.find()) return m.group(1).trim();
        // 去掉可能的前导编码后，按 - 空格 + 截断取首段
        String[] seg = s.split("[\\-\\s+]+");
        return seg.length > 0 && !seg[0].isEmpty() ? seg[0].trim() : s;
    }

    /** 采样左侧边缘像素求平均作为背景代表色（用于横幅同色）。 */
    private Color sampleBgColor(BufferedImage img) {
        int W = img.getWidth(), H = img.getHeight();
        long r = 0, gg = 0, b = 0; int n = 0;
        int x = (int)(W * 0.02);
        for (double fy : new double[]{0.15, 0.30, 0.45, 0.60, 0.75}) {
            int y = (int)(H * fy);
            int rgb = img.getRGB(x, y);
            r += (rgb >> 16) & 0xFF; gg += (rgb >> 8) & 0xFF; b += rgb & 0xFF; n++;
        }
        if (n == 0) return new Color(120, 120, 120);
        return new Color((int)(r / n), (int)(gg / n), (int)(b / n));
    }

    /**
     * 画一张配件大卡：轻微立体阴影 + 白底圆角卡；上半区横排展示配件(抠白底)；
     * 下半区通栏底条(加深背景色)写 label；卡左侧外挂红色正圆 + 白「+」。
     * 文字大小锁死 40px（基于 1024×1024 图）。
     */
    private void drawAccCard(Graphics2D g, int x, int y, int w, int h,
                             java.util.List<File> accImgs, String label, int repeat, Color banner) throws Exception {
        int arc = (int)(Math.min(w, h) * 0.10);
        // 轻微立体阴影
        int sh = (int)(Math.min(w, h) * 0.025);
        g.setColor(new Color(0, 0, 0, 45));
        g.fillRoundRect(x + sh, y + sh, w, h, arc, arc);
        // 白底圆角卡
        g.setColor(Color.WHITE);
        g.fillRoundRect(x, y, w, h, arc, arc);

        // 底条 ~20% 卡高
        int bh = (int)(h * 0.20);
        int by = y + h - bh;
        // 配件展示区（底条以上）
        int areaY = y + (int)(h * 0.07);
        int areaH = by - areaY - (int)(h * 0.04);
        int areaX = x + (int)(w * 0.04);
        int areaW = w - (int)(w * 0.08);

        // 按图片分组：底座/软管各一组(count=1)，滤芯同图合并成一组(count=N)。每组占一个横向格。
        java.util.List<File> groupImg = new java.util.ArrayList<>();
        java.util.List<Integer> groupCnt = new java.util.ArrayList<>();
        if (repeat > 0 && !accImgs.isEmpty()) {           // 兼容旧调用：单图重复 repeat 份
            groupImg.add(accImgs.get(0)); groupCnt.add(repeat);
        } else {
            for (File f : accImgs) {
                int idx = groupImg.indexOf(f);
                if (idx >= 0) groupCnt.set(idx, groupCnt.get(idx) + 1);
                else { groupImg.add(f); groupCnt.add(1); }
            }
        }
        int groups = Math.max(1, groupImg.size());
        int slotW = areaW / groups;
        for (int gi = 0; gi < groupImg.size(); gi++) {
            BufferedImage acc = whiteToTransparent(ImageIO.read(groupImg.get(gi)));
            if (acc == null) continue;
            int slotX = areaX + gi * slotW;
            int cnt = groupCnt.get(gi);
            if (cnt <= 1) {
                // 单件（底座/软管）：填满该格、留 5% 边距
                drawImageFit(g, acc, slotX + (int)(slotW * 0.05), areaY + (int)(areaH * 0.05),
                             (int)(slotW * 0.90), (int)(areaH * 0.90));
            } else {
                // 多件（滤芯）：紧密并排，>5 支则换行叠放，组内铺满该格、几乎无间隙
                int sub = (int)Math.ceil(Math.sqrt((double) cnt));      // 每行支数 ~√n
                int rowsN = (int)Math.ceil((double) cnt / sub);
                int iw = slotW / sub, ih = areaH / rowsN;
                for (int k = 0; k < cnt; k++) {
                    int rr = k / sub, cc = k % sub;
                    drawImageFit(g, acc, slotX + cc * iw, areaY + rr * ih, iw, ih);
                }
            }
        }

        // 底条（加深背景色）+ 仅底部圆角
        g.setColor(banner);
        g.fillRoundRect(x, by, w, bh, arc, arc);
        g.fillRect(x, by, w, bh / 2);
        // 底条文字（白色微软雅黑加粗；最大 40px，超宽自动缩，留内边距，居中）
        if (label != null && !label.isBlank()) {
            drawFitText(g, label, x, by, w, bh, 40, Color.WHITE);
        }

        // 卡左侧外挂红色正圆 + 白「+」
        int d  = (int)(Math.min(w, h) * 0.16);
        int cx = x - d / 2, cyc = y + (h - d) / 2;
        g.setColor(new Color(0, 0, 0, 45));
        g.fillOval(cx + sh / 2, cyc + sh / 2, d, d);
        g.setColor(new Color(0xE0, 0x2B, 0x20));
        g.fillOval(cx, cyc, d, d);
        g.setColor(Color.WHITE);
        int stroke = Math.max(3, (int)(d * 0.10));
        int half   = (int)(d * 0.28);
        int ccx = cx + d / 2, ccy = cyc + d / 2;
        g.fillRect(ccx - half, ccy - stroke / 2, half * 2, stroke);
        g.fillRect(ccx - stroke / 2, ccy - half, stroke, half * 2);
    }

    /**
     * 在 (x,y,w,h) 框内居中绘制文字：字号从 maxFs 起，若超过框宽-内边距则逐级缩小，
     * 保证文字不超出框、且四周留缝隙。用于配件卡底条 / 底部通栏。
     */
    private void drawFitText(Graphics2D g, String text, int x, int y, int w, int h, int maxFs, Color color) {
        int padX = (int)(w * 0.08), padY = (int)(h * 0.18);
        int maxTw = w - padX * 2, maxTh = h - padY * 2;
        int fs = maxFs;
        java.awt.FontMetrics fm;
        while (fs > 10) {
            g.setFont(new Font("Microsoft YaHei", Font.BOLD, fs));
            fm = g.getFontMetrics();
            if (fm.stringWidth(text) <= maxTw && fm.getHeight() <= maxTh) break;
            fs -= 2;
        }
        fm = g.getFontMetrics();
        int tx = x + (w - fm.stringWidth(text)) / 2;
        int ty = y + (h - fm.getHeight()) / 2 + fm.getAscent();
        g.setColor(color);
        g.drawString(text, tx, ty);
    }

    /** 等比缩放把 img 贴进 (x,y,w,h) 居中区域。 */
    private void drawImageFit(Graphics2D g, BufferedImage img, int x, int y, int w, int h) {
        int iw = img.getWidth(), ih = img.getHeight();
        double scale = Math.min((double) w / iw, (double) h / ih);
        int nw = (int)(iw * scale), nh = (int)(ih * scale);
        int nx = x + (w - nw) / 2, ny = y + (h - nh) / 2;
        g.drawImage(img, nx, ny, nw, nh, null);
    }

    /** 白底转透明：RGB 三通道均 >238 的像素 alpha 置 0（去掉白底图的白背景）。 */
    private BufferedImage whiteToTransparent(BufferedImage src) {
        if (src == null) return null;
        int W = src.getWidth(), H = src.getHeight();
        BufferedImage out = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < H; y++) {
            for (int x = 0; x < W; x++) {
                int argb = src.getRGB(x, y);
                int r = (argb >> 16) & 0xFF, gg = (argb >> 8) & 0xFF, b = argb & 0xFF;
                if (r > 238 && gg > 238 && b > 238) out.setRGB(x, y, 0x00FFFFFF);
                else out.setRGB(x, y, argb);
            }
        }
        return out;
    }

    /** 把 BufferedImage 压成 1024 JPG 存到 sku-gen/<batch>/<seq>_<name>.jpg。 */
    private File writeJpg(BufferedImage img, String batch, int seq, String skuName) throws Exception {
        int max = 1024, w = img.getWidth(), h = img.getHeight();
        BufferedImage out;
        if (w > max || h > max) {
            double scale = Math.min((double) max / w, (double) max / h);
            int nw = (int)(w * scale), nh = (int)(h * scale);
            out = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
            Graphics2D gg = out.createGraphics();
            gg.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            gg.drawImage(img, 0, 0, nw, nh, null); gg.dispose();
        } else {
            out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
            Graphics2D gg = out.createGraphics(); gg.drawImage(img, 0, 0, null); gg.dispose();
        }
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
        } finally { writer.dispose(); }
        return dst;
    }

    /**
     * 在花洒主图上用 Graphics2D 叠加全部中文标签。
     * AI 生图阶段输出零文字纯图片，所有标签由此方法绘制，确保中文清晰无乱码。
     */
    private File overlayChineseLabels(File imageFile, String batch, int seq) throws Exception {
        BufferedImage img = ImageIO.read(imageFile);
        if (img == null) throw new RuntimeException("无法读取图片: " + imageFile);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        int w = img.getWidth();
        int h = img.getHeight();

        // ── 左杯上方 "过滤前" — 灰色标签 + 半透明白色底衬 ──
        Font cupFont = new Font("Microsoft YaHei", Font.BOLD, (int)(w * 0.026));
        drawLabelWithBacking(g, "过滤前", (int)(w * 0.075), (int)(h * 0.77),
                             new Color(128, 128, 128), cupFont,
                             new Color(255, 255, 255, 160));

        // ── 右杯上方 "过滤后" — 红色标签 + 半透明白色底衬 ──
        drawLabelWithBacking(g, "过滤后", (int)(w * 0.225), (int)(h * 0.77),
                             new Color(220, 38, 38), cupFont,
                             new Color(255, 255, 255, 160));

        // 注：包装袋上的「手持花洒」「品质保证」等文字由袋子参考图自带，不再叠加。

        g.dispose();
        File out = new File(outputDir(batch), seq + ".png");
        ImageIO.write(img, "png", out);
        return out;
    }

    /** 居中绘制带半透明底衬的文字标签，确保在任何背景上都可读 */
    private void drawLabelWithBacking(Graphics2D g, String text, int cx, int cy,
                                       Color textColor, Font font, Color backingColor) {
        g.setFont(font);
        java.awt.FontMetrics fm = g.getFontMetrics();
        int tw = fm.stringWidth(text);
        int th = fm.getHeight();
        int x = cx - tw / 2;
        int y = cy - th / 2 + fm.getAscent();
        int pad = (int)(th * 0.2);

        // 底衬
        g.setColor(backingColor);
        g.fillRoundRect(x - pad, cy - th / 2 - pad, tw + pad * 2, th + pad * 2, pad * 2, pad * 2);
        // 文字
        g.setColor(textColor);
        g.drawString(text, x, y);
    }
}
