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
    private final ImageGenService imageGenService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final OkHttpClient http = new OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(180, TimeUnit.SECONDS)
        .build();

    public ListingService(AppProperties appProperties, TaskService taskService, ImageGenService imageGenService) {
        this.appProperties = appProperties;
        this.taskService = taskService;
        this.imageGenService = imageGenService;
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

        // 没有图片则回落标题库纯文本版
        if (imgPaths.isEmpty()) {
            return prepareFromTitleLib(category, material, brand, skuNames);
        }

        List<String> refTitles = titleRefByCategory(category);
        String refBlock = refTitles.isEmpty()
            ? "（无参考标题，按品类自行生成爆款风格）"
            : String.join("\n", refTitles);
        String brandStr2 = brandStr.isEmpty() ? "本店" : brandStr;

        String prompt = String.format(
            "你是拼多多电商运营专家。请仔细观察这些商品主图，识别商品外观、功能和卖点，" +
            "结合下面同品类爆款标题的关键词风格，生成商品标题和SKU款式名。\n\n" +
            "【同品类爆款标题参考（学其关键词和结构，不要照抄）】\n%s\n\n" +
            "商品品类：%s\n材质：%s\n品牌：%s\nSKU列表：%s\n\n" +
            "要求：\n" +
            "1. 商品标题【第一个词必须是品牌「%s」】，紧跟品类和卖点关键词；\n" +
            "2. 标题长度【严格 27-30 个汉字】（含品牌），不足则补图中观察到的卖点关键词" +
            "（如\"三档增压\"\"亲肤不刺痛\"\"免打孔\"\"加厚\"\"304不锈钢\"等），超出则精简；\n" +
            "3. 必须包含从图片观察到的核心卖点，符合拼多多搜索习惯；\n" +
            "4. 绝不要出现参考标题里别人的品牌商标名；\n" +
            "5. 同时为每个SKU生成一个15字以内款式名，风格与标题一致。\n\n" +
            "请严格按以下JSON格式返回，不要有其他内容：\n" +
            "{\"title\":\"商品标题\",\"skuNames\":{\"SKU1\":\"款式名1\",\"SKU2\":\"款式名2\"}}",
            refBlock, catLeaf, materialStr, brandStr, skuStr, brandStr2
        );

        if (imgPaths.isEmpty()) {
            // 无图：走标题库纯文本
            return prepareFromTitleLib(category, material, brand, skuNames);
        }
        try {
            String content = imageGenService.geminiText(prompt, imgPaths);
            int start = content.indexOf('{');
            int end = content.lastIndexOf('}');
            if (start >= 0 && end > start) content = content.substring(start, end + 1);
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(content, Map.class);
            return parsed;
        } catch (Exception e) {
            log.error("看图生成标题失败: {}", e.getMessage(), e);
            Map<String, Object> fallback = prepareFromTitleLib(category, material, brand, skuNames);
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

            String content = imageGenService.geminiText(prompt, null);
            int start = content.indexOf('{');
            int end = content.lastIndexOf('}');
            if (start >= 0 && end > start) content = content.substring(start, end + 1);
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = objectMapper.readValue(content, Map.class);
            return parsed;
        } catch (Exception e) {
            log.error("标题库生成标题失败: {}", e.getMessage(), e);
            Map<String, Object> fallback = prepareWithAI(catLeaf, catLeaf, brand, skuNames);
            fallback.put("error", e.getMessage());
            return fallback;
        }
    }

    /** 读取项目根目录 商品标题库.xlsx 的 A 列，每行一条标题。读不到返回空列表。 */
    private List<String> readTitleLib() {
        List<String> titles = new ArrayList<>();
        File f = new File(System.getProperty("user.dir"), "商品标题库.xlsx");
        if (!f.isFile()) {
            String rp = System.getProperty("app.resources-path");
            if (rp != null && !rp.isBlank()) {
                File rf = new File(rp, "商品标题库.xlsx");
                if (rf.isFile()) f = rf;
            }
        }
        if (!f.isFile()) { log.warn("商品标题库.xlsx 未找到: {}", f.getAbsolutePath()); return titles; }
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

    /**
     * 按品类从标题库取参考标题。标题库用分组行（如"花洒商品标题""架类商品标题"）分隔两组。
     * category 含"花洒"/"淋浴"取花洒组，否则取架类组；切不出来则返回全部。
     */
    private List<String> titleRefByCategory(String category) {
        List<String> all = readTitleLib();
        if (all.isEmpty()) return all;
        boolean isShower = category != null && (category.contains("花洒") || category.contains("淋浴"));
        List<String> shower = new ArrayList<>(), shelf = new ArrayList<>();
        List<String> cur = null;
        for (String t : all) {
            if (t.contains("花洒商品标题")) { cur = shower; continue; }
            if (t.contains("架类商品标题") || t.contains("架商品标题")) { cur = shelf; continue; }
            // 样板行的分组标题行（以"商品标题"结尾且很短）跳过
            if (t.endsWith("商品标题") && t.length() <= 8) { continue; }
            if (cur != null) cur.add(t);
        }
        List<String> picked = isShower ? shower : shelf;
        return picked.isEmpty() ? all : picked;
    }

    /**
     * 解析 产品信息填写参考.xlsx：品类全路径 → 属性列表。
     * 分组行含" > "切换品类；其余行按首个"："切分 name/value：
     *   value 含"（人工选择）" → 去后缀按"/"拆 options、manual=true；
     *   value=="人工选择" 或 无值 → manual=true、value 空；
     *   否则固定预填值。
     */
    @SuppressWarnings("unchecked")
    public Map<String, List<Map<String, Object>>> readProductInfoPresets() {
        Map<String, List<Map<String, Object>>> presets = new LinkedHashMap<>();
        File f = new File(System.getProperty("user.dir"), "产品信息填写参考.xlsx");
        if (!f.isFile()) {
            String rp = System.getProperty("app.resources-path");
            if (rp != null && !rp.isBlank()) {
                File rf = new File(rp, "产品信息填写参考.xlsx");
                if (rf.isFile()) f = rf;
            }
        }
        if (!f.isFile()) { log.warn("产品信息填写参考.xlsx 未找到: {}", f.getAbsolutePath()); return presets; }

        try (java.io.FileInputStream fis = new java.io.FileInputStream(f);
             org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook(fis)) {
            org.apache.poi.ss.usermodel.Sheet sheet = wb.getSheetAt(0);
            String curCat = null;
            for (int r = 0; r <= sheet.getLastRowNum(); r++) {
                org.apache.poi.ss.usermodel.Row row = sheet.getRow(r);
                if (row == null) continue;
                String line = getCellStr(row.getCell(0)).trim();
                if (line.isEmpty()) continue;

                if (line.contains(" > ") || line.contains(">")) {
                    curCat = line.replace("　", " ").trim();
                    presets.putIfAbsent(curCat, new ArrayList<>());
                    continue;
                }
                if (curCat == null) continue;

                String name, value;
                int idx = line.indexOf('：');
                if (idx < 0) idx = line.indexOf(':');
                if (idx >= 0) { name = line.substring(0, idx).trim(); value = line.substring(idx + 1).trim(); }
                else { name = line.trim(); value = ""; }

                Map<String, Object> attr = new LinkedHashMap<>();
                attr.put("name", name);
                List<String> options = new ArrayList<>();
                boolean manual = false;
                String fixed = "";

                if (value.contains("人工选择") || value.contains("人工")) {
                    manual = true;
                    String opt = value.replace("（人工选择）", "").replace("(人工选择)", "")
                                      .replace("人工选择", "").replace("人工", "").trim();
                    if (!opt.isEmpty()) {
                        for (String o : opt.split("/")) if (!o.trim().isEmpty()) options.add(o.trim());
                    }
                } else if (value.isEmpty()) {
                    manual = true;
                } else {
                    fixed = value;
                }
                attr.put("value", fixed);
                attr.put("options", options);
                attr.put("manual", manual);
                presets.get(curCat).add(attr);
            }
        } catch (Exception e) {
            log.warn("读取产品信息参考表失败: {}", e.getMessage());
        }
        return presets;
    }

    /** 取某品类（全路径精确匹配）的预设属性，无匹配返回空列表。 */
    public List<Map<String, Object>> productInfoFor(String category) {
        if (category == null) return new ArrayList<>();
        Map<String, List<Map<String, Object>>> all = readProductInfoPresets();
        String key = category.replace("›", ">").replace("　", " ").trim();
        // 规整空格：把 ">"两侧空格统一为" > "
        String norm = key.replaceAll("\\s*>\\s*", " > ");
        for (Map.Entry<String, List<Map<String, Object>>> e : all.entrySet()) {
            String ek = e.getKey().replaceAll("\\s*>\\s*", " > ");
            if (ek.equals(norm)) return e.getValue();
        }
        return new ArrayList<>();
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
        return runListing(config, false);
    }

    public String runListing(ListingConfig config, boolean dryRun) throws Exception {
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
                ProcessBuilder pb = dryRun
                    ? new ProcessBuilder(resolveNodeExe(), scriptFile.getAbsolutePath(), "--dry-run")
                        .directory(projectRoot).redirectErrorStream(false)
                    : new ProcessBuilder(resolveNodeExe(), scriptFile.getAbsolutePath())
                        .directory(projectRoot).redirectErrorStream(false);
                pb.environment().putAll(buildPlaywrightEnv(configJson));
                proc = pb.start();

                // config 已通过环境变量 PDD_CONFIG 传递（脚本优先读 env）。
                // 立即关闭 stdin，避免脚本不读 stdin 时后端 write 阻塞、卡死读 stdout。
                try { proc.getOutputStream().close(); } catch (Exception ignore) {}

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

        // ── 扫描 SKU 图片，按文件名自然数字顺序排序 ──
        List<String> skuImages = new ArrayList<>();
        if (skuImgDir != null) {
            File[] imgs = new File(skuImgDir).listFiles(f ->
                f.isFile() && f.getName().toLowerCase().matches(".*\\.(jpg|jpeg|png|webp|bmp|gif)$"));
            if (imgs != null) {
                Arrays.sort(imgs, java.util.Comparator.comparing(
                    f -> f.getName(), ListingService::naturalCompare));
                for (File f : imgs) skuImages.add(f.getAbsolutePath());
            }
        } else {
            warnings.add("未找到 SKU 图片文件夹（命名需含\"sku\"/\"款式\"/\"颜色\"）");
        }

        result.put("skuImages", skuImages);
        result.put("warnings", warnings);
        return result;
    }

    /** 扫描某文件夹根目录下的图片，按文件名自然数字顺序返回绝对路径列表。 */
    public List<String> listImagesInFolder(String folderPath) {
        List<String> out = new ArrayList<>();
        File dir = new File(folderPath);
        if (!dir.isDirectory()) return out;
        File[] imgs = dir.listFiles(f ->
            f.isFile() && f.getName().toLowerCase().matches(".*\\.(jpg|jpeg|png|webp|bmp|gif)$"));
        if (imgs != null) {
            Arrays.sort(imgs, java.util.Comparator.comparing(
                f -> f.getName(), ListingService::naturalCompare));
            for (File f : imgs) out.add(f.getAbsolutePath());
        }
        return out;
    }

    /** 文件名自然排序：1 < 2 < 10（按文件名中的数字段比较）。 */
    private static int naturalCompare(String a, String b) {
        String na = a.replaceAll("\\.[^.]+$", "").replaceAll("\\D", "");
        String nb = b.replaceAll("\\.[^.]+$", "").replaceAll("\\D", "");
        if (!na.isEmpty() && !nb.isEmpty()) {
            try {
                int cmp = Long.compare(Long.parseLong(na), Long.parseLong(nb));
                if (cmp != 0) return cmp;
            } catch (NumberFormatException ignore) {}
        }
        return a.compareTo(b);
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
        int    planCount      = ((Number) req.getOrDefault("planCount", 3)).intValue();
        List<Map<String, Object>> skus = (List<Map<String, Object>>) req.getOrDefault("skus", List.of());

        // 按 role 分组：主件（main，缺省）/ 配件（accessory）/ 批量件（batch，可不同数量打包）
        StringBuilder mainLines = new StringBuilder();
        StringBuilder accLines  = new StringBuilder();
        StringBuilder batchLines = new StringBuilder();
        int mainCount = 0;
        for (Map<String, Object> s : skus) {
            String role = String.valueOf(s.getOrDefault("role", "main"));
            String line = s.getOrDefault("itemCode", "") + " | " + s.getOrDefault("name", "") + "\n";
            if ("accessory".equals(role)) {
                accLines.append(line);
            } else if ("batch".equals(role)) {
                batchLines.append(line);
            } else {
                mainLines.append(line);
                mainCount++;
            }
        }
        if (accLines.length() == 0) accLines.append("（无独立配件，可只用主件单独成 SKU）\n");
        if (batchLines.length() == 0) batchLines.append("（无批量件）\n");

        String prompt = String.format(
            "你是拼多多电商运营专家。用户已选定主件款式和共享配件（来自ERP）。\n"
            + "拼多多商品是【二维规格】：维度一=主件（颜色/款式，多个并排），维度二=型号（配件组合阶梯，所有主件共享同一组型号）。\n"
            + "【关键要求】请生成 %d 套不同的「搭配方案」，每套方案 = 一个完整商品，同时包含全部 %d 个主件 和一组共享型号。"
            + "主件数量不影响方案数量：要 %d 套就出 %d 套，绝不要按主件拆分相乘。\n\n"
            + "本阶段只做\"搭配 + 命名\"，不要定价。\n\n"
            + "【商品品类】%s\n【商品简称】%s，品牌：%s，材质：%s\n"
            + "【主件清单（编码 | 名称）——作为维度一，全部并排】\n%s\n"
            + "【共享配件清单（编码 | 名称）——用于拼装维度二的型号】\n%s\n"
            + "【批量件清单（编码 | 名称）——可按不同数量打包成不同型号，如5个装/10个装】\n%s\n"
            + "【方案结构】每套方案含两个维度：\n"
            + "- mainItems：全部主件，每个给 itemCode 和 specName（颜色/款式简名，如\"银色花洒\"\"带止水银色花洒\"）\n"
            + "- models：一组型号（所有主件共享），每个型号给 specName 和 components。"
            + "components 只列【配件/批量件】编码及数量（不含主件本身）。型号按\"配件由少到多\"阶梯排列，"
            + "第一个型号通常是\"单品\"（components 为空）。\n\n"
            + "【数量档位规则（重点）】\n"
            + "- 批量件可按不同数量打包成不同型号，用 components 里的 qty 表示个数（如 qty=5 即5个装、qty=10 即10个装）\n"
            + "- 市场需求档位不确定，应铺多个数量档位让运营跑数据，如：单品/+3个装/+5个装/+10个装\n"
            + "- 型号 specName 必须体现数量和价值点，如\"过滤喷头+10支滤芯【可用1年】\"\"+5支滤芯【半年装】\"\"+3支滤芯\"\n"
            + "- 滤芯等耗材类批量件可与支架、软管叠加\n\n"
            + "【多套方案差异化策略】\n"
            + "- 精简款：3-4个型号，主推单品和热门组合\n"
            + "- 全阶梯款：单品→+配件1→+配件2→+全配件，覆盖所有价格带\n"
            + "- 套餐款：突出高配组合（多配件/多滤芯打包），拉高客单价\n"
            + "- 数量档位测试款：同一主件配批量件的不同数量（1/3/5/10个装），铺多档跑需求数据\n\n"
            + "【命名规范——必须带营销卖点词，参考标题库风格】\n"
            + "- 主件 specName：颜色/款式 + 营销卖点，如\"【雅黑色】过滤按摩增压\"\"月光银-过滤净水\"\"枪灰304不锈钢旗舰款\"，不要只写裸色名\n"
            + "- 型号 specName：用营销化的配件描述，如\"增压亲肤单喷头\"\"喷头+不锈钢支架\"\"喷头+1.5米防爆软管\"\"过滤喷头+5个滤芯\"，不要只写\"+支架\"这种干巴巴的简写\n"
            + "- 卖点词库（务必融入）：增压、亲肤、过滤、一键止水、免安装一体发货、加厚硅胶防滑、稳固不晃、防爆\n"
            + "- 每个 specName 控制在 6-15 字，既有卖点又简洁\n"
            + "- 绝不要把\"手喷袋子\"\"好评卡\"\"胶纸\"等包材写进任何 specName\n\n"
            + "【输出格式】严格按JSON，不要其他内容：\n"
            + "{\"plans\":[{\"planName\":\"方案名\",\"description\":\"30字内策略说明\","
            + "\"mainItems\":[{\"itemCode\":\"主件编码\",\"specName\":\"银色花洒\"}],"
            + "\"models\":[{\"specName\":\"单品\",\"components\":[]},{\"specName\":\"+支架\",\"components\":[{\"itemCode\":\"配件编码\",\"qty\":1}]}]}]}\n"
            + "itemCode 必须用清单里的真实编码，不要编造。",
            planCount, mainCount, planCount, planCount,
            category, productName, brand, material, mainLines, accLines, batchLines
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
