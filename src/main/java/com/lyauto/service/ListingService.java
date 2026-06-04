package com.lyauto.service;

import com.lyauto.config.AppProperties;
import com.lyauto.model.ListingConfig;
import com.lyauto.model.GenerationTask;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class ListingService {

    private static final Logger log = LoggerFactory.getLogger(ListingService.class);

    private final AppProperties appProperties;
    private final TaskService taskService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final OkHttpClient http = new OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build();

    public ListingService(AppProperties appProperties, TaskService taskService) {
        this.appProperties = appProperties;
        this.taskService = taskService;
    }

    /**
     * 调用豆包文本模型（火山方舟）生成商品标题和 SKU 款式名。
     * 返回 Map：{ "title": "...", "skuNames": { "颜色": "款式名" } }
     */
    public Map<String, Object> prepareWithAI(String productType, String productName,
                                              String brand, List<String> skuColors) {
        String brandStr = (brand != null && !brand.isBlank()) ? brand : "";
        String colorsStr = skuColors != null ? String.join("、", skuColors) : "";

        String prompt = String.format(
            "你是一个拼多多电商运营专家，请根据以下信息生成商品标题和SKU款式名。\n\n" +
            "商品类型：%s\n商品简称：%s\n品牌：%s\nSKU颜色：%s\n\n" +
            "要求：\n" +
            "1. 商品标题：30个汉字以内，包含品牌+核心卖点+颜色+材质，符合拼多多搜索习惯\n" +
            "2. SKU款式名：每个颜色对应一个款式名，格式与标题风格一致，15字以内\n\n" +
            "请严格按以下JSON格式返回，不要有其他内容：\n" +
            "{\"title\":\"商品标题\",\"skuNames\":{\"颜色1\":\"款式名1\",\"颜色2\":\"款式名2\"}}",
            productType, productName, brandStr, colorsStr
        );

        try {
            String apiKey = appProperties.getVolcengine().getApiKey();
            String baseUrl = appProperties.getVolcengine().getBaseUrl();
            if (apiKey == null || apiKey.isBlank()) {
                throw new RuntimeException("Volcengine API Key 未配置（VOLCENGINE_API_KEY）");
            }

            // 调用豆包文本模型（chat completions 接口）
            String requestBody = objectMapper.writeValueAsString(Map.of(
                "model", "doubao-seed-2-0-lite-260215",
                "messages", List.of(Map.of("role", "user", "content", prompt))
            ));

            Request req = new Request.Builder()
                .url(baseUrl + "/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .post(RequestBody.create(requestBody, MediaType.parse("application/json")))
                .build();

            try (Response resp = http.newCall(req).execute()) {
                String body = resp.body() != null ? resp.body().string() : "";
                if (!resp.isSuccessful()) {
                    throw new RuntimeException("API 调用失败 " + resp.code() + ": " + body);
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> respMap = objectMapper.readValue(body, Map.class);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> choices = (List<Map<String, Object>>) respMap.get("choices");
                @SuppressWarnings("unchecked")
                Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                String content = (String) message.get("content");

                // 提取 JSON
                int start = content.indexOf('{');
                int end = content.lastIndexOf('}');
                if (start >= 0 && end > start) content = content.substring(start, end + 1);

                @SuppressWarnings("unchecked")
                Map<String, Object> parsed = objectMapper.readValue(content, Map.class);
                return parsed;
            }
        } catch (Exception e) {
            log.error("AI 生成标题失败: {}", e.getMessage(), e);
            // 降级：返回简单拼接
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("title", brandStr + productName + (colorsStr.isEmpty() ? "" : " " + colorsStr));
            Map<String, String> skuMap = new LinkedHashMap<>();
            if (skuColors != null) skuColors.forEach(c -> skuMap.put(c, brandStr + productName + c));
            fallback.put("skuNames", skuMap);
            fallback.put("error", e.getMessage());
            return fallback;
        }
    }

    /**
     * 看图生成商品标题和 SKU 款式名（豆包视觉模型，火山方舟）。
     * 读取主图前几张转 base64，结合品类/材质/品牌生成带营销卖点词的标题。
     * 返回 Map：{ "title": "...", "skuNames": { "SKU名": "款式名" } }
     */
    public Map<String, Object> prepareWithVision(String category, String material,
                                                 String brand, List<String> skuNames,
                                                 List<String> mainImgPaths, String mainImgDir) {
        String brandStr = (brand != null && !brand.isBlank()) ? brand : "";
        String materialStr = (material != null && !material.isBlank()) ? material : "";
        String skuStr = skuNames != null ? String.join("、", skuNames) : "";
        // 品类取叶子名作为商品类型描述
        String catLeaf = "";
        if (category != null && !category.isBlank()) {
            String[] segs = category.split("[>›]");
            catLeaf = segs[segs.length - 1].trim();
        }

        // 若没传具体路径，但给了主图目录，则读目录取前几张
        List<String> imgPaths = new ArrayList<>();
        if (mainImgPaths != null) imgPaths.addAll(mainImgPaths);
        if (imgPaths.isEmpty() && mainImgDir != null && !mainImgDir.isBlank()) {
            File dir = new File(mainImgDir);
            if (dir.isDirectory()) {
                File[] files = dir.listFiles(f -> f.isFile()
                    && f.getName().toLowerCase().matches(".*\\.(jpg|jpeg|png|webp)"));
                if (files != null) {
                    Arrays.sort(files, Comparator.comparing(File::getName));
                    for (File f : files) imgPaths.add(f.getAbsolutePath());
                }
            }
        }

        // 没有图片则回落纯文本版
        if (imgPaths.isEmpty()) {
            return prepareWithAI(catLeaf, catLeaf, brand, skuNames);
        }

        String prompt = String.format(
            "你是拼多多电商运营专家。请仔细观察这些商品主图，判断商品的外观、功能和卖点，" +
            "结合以下信息生成商品标题和SKU款式名。\n\n" +
            "商品品类：%s\n材质：%s\n品牌：%s\nSKU列表：%s\n\n" +
            "要求：\n" +
            "1. 商品标题：30个汉字以内，开头可放品牌，必须包含从图片观察到的核心卖点营销词" +
            "（如\"三档增压\"\"亲肤不刺痛\"\"免打孔\"\"大容量\"\"加厚\"等），符合拼多多搜索习惯；" +
            "可参考同类爆款标题的风格，但绝对不要抄袭任何品牌商标名。\n" +
            "2. SKU款式名：每个SKU对应一个款式名，与标题风格一致，15字以内。\n\n" +
            "请严格按以下JSON格式返回，不要有其他内容：\n" +
            "{\"title\":\"商品标题\",\"skuNames\":{\"SKU1\":\"款式名1\",\"SKU2\":\"款式名2\"}}",
            catLeaf, materialStr, brandStr, skuStr
        );

        try {
            String apiKey = appProperties.getVolcengine().getApiKey();
            String baseUrl = appProperties.getVolcengine().getBaseUrl();
            if (apiKey == null || apiKey.isBlank()) {
                throw new RuntimeException("Volcengine API Key 未配置（VOLCENGINE_API_KEY）");
            }

            // 组装多模态 content：先文字，再图片（最多取前 3 张）
            List<Map<String, Object>> contentArr = new ArrayList<>();
            contentArr.add(Map.of("type", "text", "text", prompt));
            int imgCount = 0;
            for (String p : imgPaths) {
                if (imgCount >= 3) break;
                String dataUri = toDataUri(p);
                if (dataUri == null) continue;
                contentArr.add(Map.of(
                    "type", "image_url",
                    "image_url", Map.of("url", dataUri)
                ));
                imgCount++;
            }
            if (imgCount == 0) {
                // 图片都读不出来，回落纯文本
                return prepareWithAI(catLeaf, catLeaf, brand, skuNames);
            }

            String requestBody = objectMapper.writeValueAsString(Map.of(
                "model", "doubao-1.5-vision-pro-32k-250115",
                "messages", List.of(Map.of("role", "user", "content", contentArr))
            ));

            Request req = new Request.Builder()
                .url(baseUrl + "/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .post(RequestBody.create(requestBody, MediaType.parse("application/json")))
                .build();

            try (Response resp = http.newCall(req).execute()) {
                String body = resp.body() != null ? resp.body().string() : "";
                if (!resp.isSuccessful()) {
                    throw new RuntimeException("视觉 API 调用失败 " + resp.code() + ": " + body);
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> respMap = objectMapper.readValue(body, Map.class);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> choices = (List<Map<String, Object>>) respMap.get("choices");
                @SuppressWarnings("unchecked")
                Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                String content = (String) message.get("content");

                int start = content.indexOf('{');
                int end = content.lastIndexOf('}');
                if (start >= 0 && end > start) content = content.substring(start, end + 1);

                @SuppressWarnings("unchecked")
                Map<String, Object> parsed = objectMapper.readValue(content, Map.class);
                return parsed;
            }
        } catch (Exception e) {
            log.error("看图生成标题失败: {}", e.getMessage(), e);
            // 降级：回落纯文本版
            Map<String, Object> fallback = prepareWithAI(catLeaf, catLeaf, brand, skuNames);
            fallback.put("error", e.getMessage());
            return fallback;
        }
    }

    /**
     * 参考「标题库.xlsx」（同品类爆款标题）生成新标题，品牌词替换为前端输入品牌。
     * 返回 Map：{ "title": "...", "skuNames": { "SKU名": "款式名" } }
     */
    public Map<String, Object> prepareFromTitleLib(String category, String material,
                                                   String brand, List<String> skuNames) {
        String brandStr = (brand != null && !brand.isBlank()) ? brand.trim() : "";
        String materialStr = (material != null && !material.isBlank()) ? material : "";
        String skuStr = skuNames != null ? String.join("、", skuNames) : "";
        String catLeaf = "";
        if (category != null && !category.isBlank()) {
            String[] segs = category.split("[>›]");
            catLeaf = segs[segs.length - 1].trim();
        }

        // 读标题库
        List<String> refTitles = readTitleLib();

        try {
            String apiKey = appProperties.getVolcengine().getApiKey();
            String baseUrl = appProperties.getVolcengine().getBaseUrl();
            if (apiKey == null || apiKey.isBlank()) {
                throw new RuntimeException("Volcengine API Key 未配置（VOLCENGINE_API_KEY）");
            }

            String refBlock = refTitles.isEmpty()
                ? "（无参考标题，请根据品类自行生成同类爆款风格标题）"
                : String.join("\n", refTitles);
            String brandRule = brandStr.isEmpty()
                ? "本商品不指定品牌：生成的标题里【绝对不要】出现任何品牌名（包括参考标题里的品牌词，要全部去掉），只保留品类、卖点、用途等通用词。"
                : "本商品品牌为「" + brandStr + "」：标题开头放该品牌，并把参考标题里别人的品牌词全部替换掉，不要出现参考标题中的原品牌名。";

            String prompt =
                "你是拼多多电商运营专家。下面是同品类的爆款商品标题，供你参考其关键词、卖点和结构：\n" +
                refBlock + "\n\n" +
                "请模仿上面标题的风格和关键词，为以下商品生成 1 条新的拼多多标题。\n" +
                "商品品类：" + catLeaf + "\n材质：" + materialStr + "\nSKU列表：" + skuStr + "\n\n" +
                "要求：\n" +
                "1. 标题 30 个汉字以内，融合多条参考标题的卖点关键词，不要原样照抄任何一条。\n" +
                "2. " + brandRule + "\n" +
                "3. 同时为每个 SKU 名生成一个 15 字以内的款式名，风格与标题一致。\n\n" +
                "请严格按以下JSON格式返回，不要有其他内容：\n" +
                "{\"title\":\"商品标题\",\"skuNames\":{\"SKU1\":\"款式名1\"}}";

            String requestBody = objectMapper.writeValueAsString(Map.of(
                "model", "doubao-seed-2-0-lite-260215",
                "messages", List.of(Map.of("role", "user", "content", prompt))
            ));

            Request req = new Request.Builder()
                .url(baseUrl + "/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .post(RequestBody.create(requestBody, MediaType.parse("application/json")))
                .build();

            try (Response resp = http.newCall(req).execute()) {
                String body = resp.body() != null ? resp.body().string() : "";
                if (!resp.isSuccessful()) {
                    throw new RuntimeException("标题生成 API 失败 " + resp.code() + ": " + body);
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> respMap = objectMapper.readValue(body, Map.class);
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> choices = (List<Map<String, Object>>) respMap.get("choices");
                @SuppressWarnings("unchecked")
                Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                String content = (String) message.get("content");
                int start = content.indexOf('{');
                int end = content.lastIndexOf('}');
                if (start >= 0 && end > start) content = content.substring(start, end + 1);
                @SuppressWarnings("unchecked")
                Map<String, Object> parsed = objectMapper.readValue(content, Map.class);
                return parsed;
            }
        } catch (Exception e) {
            log.error("标题库生成标题失败: {}", e.getMessage(), e);
            Map<String, Object> fallback = prepareWithAI(catLeaf, catLeaf, brand, skuNames);
            fallback.put("error", e.getMessage());
            return fallback;
        }
    }

    /** 读取项目根目录 标题库.xlsx 的 A 列，每行一条标题。读不到返回空列表。 */
    private List<String> readTitleLib() {
        List<String> titles = new ArrayList<>();
        File f = new File(System.getProperty("user.dir"), "标题库.xlsx");
        if (!f.isFile()) {
            String rp = System.getProperty("app.resources-path");
            if (rp != null && !rp.isBlank()) {
                File rf = new File(rp, "标题库.xlsx");
                if (rf.isFile()) f = rf;
            }
        }
        if (!f.isFile()) { log.warn("标题库.xlsx 未找到: {}", f.getAbsolutePath()); return titles; }
        try (java.io.FileInputStream fis = new java.io.FileInputStream(f);
             org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook(fis)) {
            org.apache.poi.ss.usermodel.Sheet sheet = wb.getSheetAt(0);
            for (int r = 0; r <= sheet.getLastRowNum(); r++) {
                org.apache.poi.ss.usermodel.Row row = sheet.getRow(r);
                if (row == null) continue;
                String t = getCellStr(row.getCell(0)).trim();
                if (!t.isEmpty()) titles.add(t);
            }
        } catch (Exception e) {
            log.warn("读取标题库失败: {}", e.getMessage());
        }
        return titles;
    }

    /** 读取本地图片转 data URI（base64）。读取失败返回 null。 */
    private String toDataUri(String imgPath) {
        if (imgPath == null || imgPath.isBlank()) return null;
        File f = new File(imgPath);
        if (!f.isFile()) return null;
        try {
            byte[] bytes = java.nio.file.Files.readAllBytes(f.toPath());
            String name = f.getName().toLowerCase();
            String mime = name.endsWith(".png") ? "image/png"
                        : name.endsWith(".webp") ? "image/webp"
                        : "image/jpeg";
            return "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (Exception e) {
            log.warn("读取图片失败 {}: {}", imgPath, e.getMessage());
            return null;
        }
    }

    /**
     * 启动 Playwright 自动化子进程，异步执行拼多多上新流程。
     * 返回 taskId，前端通过 /api/task/{taskId} 轮询进度。
     */
    public String runListing(ListingConfig config) throws Exception {
        GenerationTask task = taskService.createTask(10);

        File scriptFile = resolvePlaywrightScript();
        if (scriptFile == null || !scriptFile.exists()) {
            throw new RuntimeException("找不到 Playwright 脚本 pdd_listing.js，请确认 tools/ 目录下已安装");
        }

        // cookies 路径
        String userDataDir = appProperties.getPaths().getUserDataDir();
        if (userDataDir == null || userDataDir.isBlank()) userDataDir = System.getProperty("user.dir");
        if (config.getCookiesPath() == null || config.getCookiesPath().isBlank()) {
            config.setCookiesPath(userDataDir + "/pdd_cookies.json");
        }

        String configJson = objectMapper.writeValueAsString(config);
        File projectRoot = scriptFile.getParentFile();

        taskService.submit(task, () -> {
            Process proc = null;
            try {
                ProcessBuilder pb = new ProcessBuilder(resolveNodeExe(), scriptFile.getAbsolutePath())
                    .directory(projectRoot)
                    .redirectErrorStream(false);
                pb.environment().putAll(buildPlaywrightEnv(configJson));
                proc = pb.start();

                // 写 stdin
                try (OutputStream os = proc.getOutputStream()) {
                    os.write(configJson.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }

                // 读 stdout 解析进度
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(proc.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        log.info("[pdd_listing] {}", line);
                        if (line.startsWith("PROGRESS:")) {
                            String[] parts = line.split(":", 3);
                            String msg = parts.length >= 3 ? parts[2] : line;
                            task.addResult(Map.of("type", "progress", "message", msg));
                            task.incrementProgress();
                        } else if (line.startsWith("DONE:")) {
                            task.addResult(Map.of("type", "done", "message", "上新完成"));
                        } else if (line.startsWith("ERROR:")) {
                            task.addResult(Map.of("type", "error", "message", line.substring(6)));
                        } else if (!line.isBlank()) {
                            task.addResult(Map.of("type", "log", "message", line));
                        }
                    }
                }

                // 读 stderr
                try (BufferedReader err = new BufferedReader(
                        new InputStreamReader(proc.getErrorStream(), java.nio.charset.StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = err.readLine()) != null) {
                        if (!line.isBlank()) task.addResult(Map.of("type", "log", "message", "[err] " + line));
                    }
                }

                boolean done = proc.waitFor(30, java.util.concurrent.TimeUnit.MINUTES);
                if (!done) {
                    proc.destroyForcibly();
                    task.addResult(Map.of("type", "error", "message", "自动化超时（30分钟）"));
                }
            } catch (Exception e) {
                log.error("Playwright 子进程异常: {}", e.getMessage(), e);
                task.addResult(Map.of("type", "error", "message", "自动化异常: " + e.getMessage()));
            } finally {
                if (proc != null) try { proc.destroyForcibly(); } catch (Exception ignored) {}
            }
        });

        return task.getId();
    }

    public File resolvePlaywrightScript() {
        // 打包态：resources/tools/pdd_listing.js
        String resourcesPath = System.getProperty("app.resources-path");
        if (resourcesPath != null && !resourcesPath.isBlank()) {
            File f = new File(resourcesPath, "tools/pdd_listing.js");
            if (f.exists()) return f;
        }
        // 源码态：user.dir/tools/pdd_listing.js
        return new File(System.getProperty("user.dir"), "tools/pdd_listing.js");
    }

    /**
     * 解析 node 可执行文件路径。
     * 优先用打包的便携 node（resources/tools/node/node.exe 或 user.dir/tools/node/node.exe），
     * 都找不到则回退系统 PATH 里的 "node"（开发机）。
     * 这样客户机无需自装 Node.js。
     */
    public String resolveNodeExe() {
        String exe = System.getProperty("os.name", "").toLowerCase().contains("win") ? "node.exe" : "node";
        java.util.List<File> candidates = new java.util.ArrayList<>();
        // 打包态：app.resources-path 指向 resources/
        String resourcesPath = System.getProperty("app.resources-path");
        if (resourcesPath != null && !resourcesPath.isBlank()) {
            candidates.add(new File(resourcesPath, "tools/node/" + exe));
            // 兼容 resourcesPath 可能指向 app 根（resources 的父级）的情形
            candidates.add(new File(resourcesPath, "resources/tools/node/" + exe));
        }
        // 源码态：user.dir/tools/node/
        candidates.add(new File(System.getProperty("user.dir"), "tools/node/" + exe));
        // 兜底：从脚本所在 tools 目录推断（resolvePlaywrightScript 同源）
        File script = resolvePlaywrightScript();
        if (script != null) {
            File toolsDir = script.getParentFile();
            if (toolsDir != null) candidates.add(new File(toolsDir, "node/" + exe));
        }
        for (File f : candidates) {
            if (f.isFile()) {
                log.info("使用便携 node: {}", f.getAbsolutePath());
                return f.getAbsolutePath();
            }
        }
        log.warn("未找到便携 node，回退系统 node。已尝试: {}", candidates);
        return "node";
    }

    /**
     * 构建 Playwright 子进程的环境变量。
     * 打包态：PLAYWRIGHT_BROWSERS_PATH 指向 resources/tools/browsers/
     * 源码态：指向 user.dir/tools/browsers/
     */
    private java.util.Map<String, String> buildPlaywrightEnv(String configJson) {
        java.util.Map<String, String> env = new java.util.HashMap<>(System.getenv());
        env.put("PDD_CONFIG", configJson);

        // 找 browsers 目录
        String resourcesPath = System.getProperty("app.resources-path");
        File browsersDir = null;
        if (resourcesPath != null && !resourcesPath.isBlank()) {
            File f = new File(resourcesPath, "tools/browsers");
            if (f.isDirectory()) browsersDir = f;
        }
        if (browsersDir == null) {
            File f = new File(System.getProperty("user.dir"), "tools/browsers");
            if (f.isDirectory()) browsersDir = f;
        }
        if (browsersDir != null) {
            env.put("PLAYWRIGHT_BROWSERS_PATH", browsersDir.getAbsolutePath());
        }

        // node_modules 路径（打包态 node 需要找到 playwright 模块）
        String resourcesPath2 = System.getProperty("app.resources-path");
        File nodeModulesDir = null;
        if (resourcesPath2 != null && !resourcesPath2.isBlank()) {
            File f = new File(resourcesPath2, "tools/node_modules");
            if (f.isDirectory()) nodeModulesDir = f;
        }
        if (nodeModulesDir == null) {
            File f = new File(System.getProperty("user.dir"), "tools/node_modules");
            if (f.isDirectory()) nodeModulesDir = f;
        }
        if (nodeModulesDir != null) {
            // 把 node_modules/.bin 加到 PATH，让 node 能找到 playwright
            String existingPath = env.getOrDefault("PATH", "");
            env.put("PATH", nodeModulesDir.getAbsolutePath() + File.pathSeparator + existingPath);
        }

        return env;
    }

    /**
     * 扫描商品大文件夹：自动识别主图/SKU/详情/白底子文件夹，解析 xlsx 定价表，
     * 按文件名匹配 SKU 图片，返回结构化数据供前端填充上新表单。
     */
    public Map<String, Object> scanFolder(String folderPath) throws Exception {
        File root = new File(folderPath);
        if (!root.isDirectory()) throw new IllegalArgumentException("路径不是文件夹：" + folderPath);

        Map<String, Object> result = new LinkedHashMap<>();
        List<String> warnings = new ArrayList<>();

        // ── 识别子文件夹 ──
        String mainImgDir = null, detailImgDir = null, whiteImgDir = null, skuImgDir = null;
        File[] dirs = root.listFiles(File::isDirectory);
        if (dirs != null) {
            for (File d : dirs) {
                String n = d.getName().toLowerCase();
                if (n.contains("主图") || n.equals("main"))          mainImgDir   = d.getAbsolutePath();
                else if (n.contains("sku") || n.contains("款式") || n.contains("颜色")) skuImgDir = d.getAbsolutePath();
                else if (n.contains("详情") || n.contains("detail")) detailImgDir = d.getAbsolutePath();
                else if (n.contains("白底") || n.contains("white"))  whiteImgDir  = d.getAbsolutePath();
            }
        }
        result.put("mainImgDir",   mainImgDir   != null ? mainImgDir   : "");
        result.put("detailImgDir", detailImgDir != null ? detailImgDir : "");
        result.put("whiteImgDir",  whiteImgDir  != null ? whiteImgDir  : "");
        result.put("skuImgDir",    skuImgDir    != null ? skuImgDir    : "");

        // ── 找 xlsx 文件 ──
        File[] xlsxFiles = root.listFiles(f -> f.isFile() && f.getName().toLowerCase().endsWith(".xlsx"));
        if (xlsxFiles == null || xlsxFiles.length == 0) {
            warnings.add("未找到 .xlsx 文件");
            result.put("skus", List.of());
            result.put("warnings", warnings);
            return result;
        }
        File excelFile = xlsxFiles[0];
        result.put("excelFile", excelFile.getName());

        // ── 解析 xlsx ──
        List<Map<String, Object>> skus = new ArrayList<>();
        try (java.io.FileInputStream fis = new java.io.FileInputStream(excelFile);
             org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook(fis)) {

            org.apache.poi.ss.usermodel.Sheet sheet = wb.getSheetAt(0);
            int headerRow = -1, codeCol = 0, priceCol = 2, groupPriceCol = 8, costCol = 1;

            // 找表头行（含"商品编码"的行）
            for (int r = 0; r <= Math.min(5, sheet.getLastRowNum()); r++) {
                org.apache.poi.ss.usermodel.Row row = sheet.getRow(r);
                if (row == null) continue;
                org.apache.poi.ss.usermodel.Cell c0 = row.getCell(0);
                if (c0 != null && "商品编码".equals(getCellStr(c0).trim())) {
                    headerRow = r;
                    for (int c = 0; c < row.getLastCellNum(); c++) {
                        String h = getCellStr(row.getCell(c)).trim();
                        if ("价格".equals(h))        priceCol      = c;
                        else if ("拼单价".equals(h)) groupPriceCol = c;
                        else if ("总成本".equals(h)) costCol       = c;
                    }
                    break;
                }
            }

            if (headerRow < 0) {
                warnings.add("Excel 中未找到「商品编码」表头行");
            } else {
                final String skuDir = skuImgDir;
                for (int r = headerRow + 1; r <= sheet.getLastRowNum(); r++) {
                    org.apache.poi.ss.usermodel.Row row = sheet.getRow(r);
                    if (row == null) continue;
                    String code = getCellStr(row.getCell(codeCol)).trim();
                    if (code.isEmpty()) continue;

                    double price      = getCellDouble(row.getCell(priceCol));
                    double groupPrice = getCellDouble(row.getCell(groupPriceCol));
                    double cost       = getCellDouble(row.getCell(costCol));

                    // 在 SKU 子文件夹中按文件名（不含扩展名）匹配图片
                    String imgPath = "";
                    if (skuDir != null) {
                        File[] imgs = new File(skuDir).listFiles(f -> {
                            String base = f.getName().replaceAll("\\.[^.]+$", "");
                            return f.isFile() && base.equals(code);
                        });
                        if (imgs != null && imgs.length > 0) {
                            imgPath = imgs[0].getAbsolutePath();
                        } else {
                            warnings.add("SKU图未找到: " + code);
                        }
                    }

                    Map<String, Object> sku = new LinkedHashMap<>();
                    sku.put("name",        code);
                    sku.put("itemCode",    code);
                    sku.put("cost",        cost);
                    sku.put("groupPrice",  groupPrice);
                    sku.put("singlePrice", price);
                    sku.put("stock",       999);
                    sku.put("imgPath",     imgPath);
                    skus.add(sku);
                }
            }
        } catch (Exception e) {
            warnings.add("Excel 解析失败: " + e.getMessage());
        }

        result.put("skus", skus);
        result.put("warnings", warnings);
        return result;
    }

    /**
     * 调用 AI 生成多套 SKU 布局和定价方案。
     * pricingStrategy: "high"(45-65%) | "mid"(25-35%) | "low"(10-20%)
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> generateSkuPlans(Map<String, Object> req) throws Exception {
        String category       = (String) req.getOrDefault("category", "");
        String productName    = (String) req.getOrDefault("productName", "");
        String brand          = (String) req.getOrDefault("brand", "");
        String material       = (String) req.getOrDefault("material", "");
        String strategy       = (String) req.getOrDefault("pricingStrategy", "mid");
        int    planCount      = ((Number) req.getOrDefault("planCount", 3)).intValue();
        List<Map<String, Object>> skus = (List<Map<String, Object>>) req.getOrDefault("skus", List.of());

        String strategyLabel = switch (strategy) {
            case "high" -> "高毛利，目标毛利率 45-65%";
            case "low"  -> "低毛利，目标毛利率 10-20%";
            default     -> "中毛利，目标毛利率 25-35%";
        };

        StringBuilder skuLines = new StringBuilder();
        for (Map<String, Object> s : skus) {
            skuLines.append(s.get("itemCode")).append(" | 成本 ").append(s.get("cost")).append(" 元\n");
        }

        String prompt = String.format(
            "你是拼多多电商运营专家，请根据以下信息生成 %d 套不同的 SKU 布局和定价方案。\n\n" +
            "商品品类：%s\n商品简称：%s，品牌：%s，材质：%s\n定价策略：%s\n\n" +
            "现有 SKU 成本数据（商品编码 | 成本）：\n%s\n" +
            "要求：\n" +
            "1. 每套方案给出不同的 SKU 组合逻辑（如阶梯装、套餐组合、单品精简、多规格测试等）\n" +
            "2. 每个 SKU 给出：款式名（功能词+颜色/型号+品名，15字以内）、拼单价、单买价\n" +
            "3. 定价需满足目标毛利率，拼单价约为单买价的 0.85-0.92 倍\n" +
            "4. 每套方案给出简短说明（30字以内）\n" +
            "5. itemCode 保持与输入一致，不要修改\n\n" +
            "严格按以下 JSON 格式返回，不要有其他内容：\n" +
            "{\"plans\":[{\"planName\":\"方案一：xxx\",\"description\":\"...\",\"skus\":[{\"name\":\"...\",\"itemCode\":\"...\",\"groupPrice\":0.0,\"singlePrice\":0.0,\"stock\":999}]}]}",
            planCount, category, productName, brand, material, strategyLabel, skuLines
        );

        String apiKey = appProperties.getVolcengine().getApiKey();
        String baseUrl = appProperties.getVolcengine().getBaseUrl();
        if (apiKey == null || apiKey.isBlank()) throw new RuntimeException("Volcengine API Key 未配置");

        String requestBody = objectMapper.writeValueAsString(Map.of(
            "model", "doubao-seed-2-0-lite-260215",
            "messages", List.of(Map.of("role", "user", "content", prompt))
        ));

        Request httpReq = new Request.Builder()
            .url(baseUrl + "/chat/completions")
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .post(RequestBody.create(requestBody, MediaType.parse("application/json")))
            .build();

        try (Response resp = http.newCall(httpReq).execute()) {
            String body = resp.body() != null ? resp.body().string() : "";
            if (!resp.isSuccessful()) throw new RuntimeException("API 调用失败 " + resp.code() + ": " + body);

            Map<String, Object> respMap = objectMapper.readValue(body, Map.class);
            List<Map<String, Object>> choices = (List<Map<String, Object>>) respMap.get("choices");
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");

            int start = content.indexOf('{');
            int end   = content.lastIndexOf('}');
            if (start >= 0 && end > start) content = content.substring(start, end + 1);

            return objectMapper.readValue(content, Map.class);
        }
    }

    private String getCellStr(org.apache.poi.ss.usermodel.Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING  -> cell.getStringCellValue();
            case NUMERIC -> String.valueOf(cell.getNumericCellValue());
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default      -> "";
        };
    }

    private double getCellDouble(org.apache.poi.ss.usermodel.Cell cell) {
        if (cell == null) return 0;
        if (cell.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC)
            return cell.getNumericCellValue();
        try { return Double.parseDouble(cell.getStringCellValue().trim()); } catch (Exception e) { return 0; }
    }

    /** 仅触发登录流程（--login-only），保存 cookies 后退出。 */
    public String runLoginOnly() throws Exception {
        File scriptFile = resolvePlaywrightScript();
        if (scriptFile == null || !scriptFile.exists()) {
            throw new RuntimeException("找不到 pdd_listing.js");
        }
        String userDataDir = appProperties.getPaths().getUserDataDir();
        if (userDataDir == null || userDataDir.isBlank()) userDataDir = System.getProperty("user.dir");
        String cookiesPath = userDataDir + "/pdd_cookies.json";

        GenerationTask task = taskService.createTask(2);
        File projectRoot = scriptFile.getParentFile();
        final String cp = cookiesPath;

        taskService.submit(task, () -> {
            Process proc = null;
            try {
                ProcessBuilder pb = new ProcessBuilder(resolveNodeExe(), scriptFile.getAbsolutePath(), "--login-only")
                    .directory(projectRoot).redirectErrorStream(false);
                pb.environment().putAll(buildPlaywrightEnv(objectMapper.writeValueAsString(Map.of("cookiesPath", cp))));
                proc = pb.start();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(proc.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (!line.isBlank()) task.addResult(Map.of("type", "log", "message", line));
                    }
                }
                boolean finished = proc.waitFor(10, java.util.concurrent.TimeUnit.MINUTES);
                int exitCode = finished ? proc.exitValue() : -1;
                if (exitCode == 0) {
                    task.addResult(Map.of("type", "done", "message", "登录完成，cookies 已保存"));
                } else {
                    task.addResult(Map.of("type", "error", "message", "登录脚本异常退出（exitCode=" + exitCode + "），请重试"));
                }
            } catch (Exception e) {
                task.addResult(Map.of("type", "error", "message", "登录失败: " + e.getMessage()));
            } finally {
                if (proc != null) try { proc.destroyForcibly(); } catch (Exception ignored) {}
            }
        });
        return task.getId();
    }
}
