package com.lyauto.controller;

import com.lyauto.model.ListingConfig;
import com.lyauto.service.ListingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/listing")
public class ListingController {

    private static final Logger log = LoggerFactory.getLogger(ListingController.class);
    private final ListingService listingService;
    private final com.lyauto.service.ImageGenService imageGenService;
    private final com.lyauto.service.PromptTemplateService templateService;
    private final com.lyauto.service.AccessoryRuleService accessoryRuleService;

    public ListingController(ListingService listingService,
                             com.lyauto.service.ImageGenService imageGenService,
                             com.lyauto.service.PromptTemplateService templateService,
                             com.lyauto.service.AccessoryRuleService accessoryRuleService) {
        this.listingService = listingService;
        this.imageGenService = imageGenService;
        this.templateService = templateService;
        this.accessoryRuleService = accessoryRuleService;
    }

    /** 配件搭配规则库：读取（前端规则编辑用）。 */
    @GetMapping("/accessory-rules")
    public ResponseEntity<String> getAccessoryRules() {
        return ResponseEntity.ok()
            .header("Content-Type", "application/json; charset=UTF-8")
            .body(accessoryRuleService.loadJson());
    }

    /** 配件搭配规则库：保存。 */
    @PostMapping("/accessory-rules")
    public ResponseEntity<Map<String, Object>> saveAccessoryRules(@RequestBody String json) {
        try {
            accessoryRuleService.saveJson(json);
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "保存规则失败：" + e.getMessage()));
        }
    }

    /**
     * 全自动上新·第一步：只选了主件，按规则库解析出该搭配哪些配件/批量件 + 阶梯型号。
     * 入参：{ category, mainItemCode, erpSkus:[{itemCode,name}...] }
     * 出参：{ ladders:[...], accSkus:[{itemCode,name,role,keyword,defaultQty}...] }
     * 前端拿到后复用现有 calc-combo-cost → pricing → prepare → gen-sku-images 链路。
     */
    @PostMapping("/auto-resolve")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> autoResolve(@RequestBody Map<String, Object> body) {
        try {
            String category = String.valueOf(body.getOrDefault("category", ""));
            String mainCode = String.valueOf(body.getOrDefault("mainItemCode", ""));
            List<Map<String, Object>> erpSkus = (List<Map<String, Object>>) body.getOrDefault("erpSkus", List.of());
            return ResponseEntity.ok(accessoryRuleService.resolveForMain(category, mainCode, erpSkus));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "规则解析失败：" + e.getMessage()));
        }
    }

    /** 防比价模板库：读取（前端下拉/编辑用）。 */
    @GetMapping("/antiprice-templates")
    public ResponseEntity<String> getAntiPriceTemplates() {
        return ResponseEntity.ok()
            .header("Content-Type", "application/json; charset=UTF-8")
            .body(templateService.loadJson());
    }

    /** 防比价模板库：保存（前端编辑后写回，运行时即时生效）。 */
    @PostMapping("/antiprice-templates")
    public ResponseEntity<Map<String, Object>> saveAntiPriceTemplates(@RequestBody String json) {
        try {
            templateService.saveJson(json);
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "保存模板失败：" + e.getMessage()));
        }
    }

    /**
     * AI 生成商品标题和 SKU 款式名。
     * 有主图（mainImgPaths）则看图生成（豆包视觉），否则纯文本生成。
     * 入参：{ category, material, brand, skuNames/skuColors, mainImgPaths,
     *        productType, productName }（后两个为兼容旧调用）
     * 出参：{ title, skuNames: { "SKU": "款式名" } }
     */
    @PostMapping("/prepare")
    public ResponseEntity<Map<String, Object>> prepare(@RequestBody Map<String, Object> body) {
        try {
            String category   = (String) body.getOrDefault("category", "");
            String material   = (String) body.getOrDefault("material", "");
            String brand      = (String) body.getOrDefault("brand", "");
            if (brand == null || brand.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "请先填写品牌（标题最前面必须是品牌）"));
            }
            @SuppressWarnings("unchecked")
            List<String> skuNames = (List<String>) body.getOrDefault("skuNames",
                                     body.getOrDefault("skuColors", List.of()));
            @SuppressWarnings("unchecked")
            List<String> mainImgPaths = (List<String>) body.getOrDefault("mainImgPaths", List.of());
            String mainImgDir = (String) body.getOrDefault("mainImgDir", "");
            boolean useVision = Boolean.TRUE.equals(body.get("useVision"));

            Map<String, Object> result;
            if (useVision && ((mainImgPaths != null && !mainImgPaths.isEmpty()) || (mainImgDir != null && !mainImgDir.isBlank()))) {
                // 看图生成（仅当显式 useVision=true）
                result = listingService.prepareWithVision(category, material, brand, skuNames, mainImgPaths, mainImgDir);
            } else if (category != null && !category.isBlank()) {
                // 默认：参考标题库生成
                result = listingService.prepareFromTitleLib(category, material, brand, skuNames);
            } else {
                // 兜底纯文本
                String productType = (String) body.getOrDefault("productType", category);
                String productName = (String) body.getOrDefault("productName", "");
                result = listingService.prepareWithAI(productType, productName, brand, skuNames);
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "AI 生成失败：" + e.getMessage()));
        }
    }

    /**
     * 以参考主图为底，逐个 SKU 生成展示图。
     * 入参：{ refImagePath, productType, skus:[{name, compDesc}] }
     * 出参：{ images:[{name, path, error?}] }
     */
    @PostMapping("/gen-sku-images")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> genSkuImages(@RequestBody Map<String, Object> body) {
        try {
            String refImagePath = (String) body.getOrDefault("refImagePath", "");
            String productType  = (String) body.getOrDefault("productType", "");
            String bagImagePath = (String) body.getOrDefault("bagImagePath", "");
            String waterImagePath = (String) body.getOrDefault("waterImagePath", "");
            List<String> accImagePaths = (List<String>) body.getOrDefault("accImagePaths", List.of());
            List<Map<String, Object>> skus = (List<Map<String, Object>>) body.getOrDefault("skus", List.of());
            String templateId = (String) body.getOrDefault("templateId", "");  // 防比价模板（整批统一）
            // 批次号：前端整批生图传同一个 batch，使所有 SKU 落到同一 sku-gen/<batch>/ 文件夹；没传才用当前时间
            String batch = String.valueOf(body.getOrDefault("batch", ""));
            if (batch == null || batch.isBlank() || "null".equals(batch)) batch = String.valueOf(System.currentTimeMillis());

            // 同批共享背景：优先用前端传入的 bgStyle（前端整批只分析一次再分发，保证并发各 SKU 背景一致）；
            // 没传则后端自行分析一次。
            String bgStyle = (String) body.getOrDefault("bgStyle", "");
            if (bgStyle == null || bgStyle.isBlank()) {
                bgStyle = imageGenService.analyzeBackgroundStyleOnce(refImagePath);
            }

            List<Map<String, Object>> images = new java.util.ArrayList<>();
            int loop = 0;
            for (Map<String, Object> s : skus) {
                String name = String.valueOf(s.getOrDefault("name", ""));
                String comp = String.valueOf(s.getOrDefault("compDesc", ""));
                Object idx  = s.getOrDefault("idx", loop);
                // 图名序号用全局 idx+1（每次请求只带一个 SKU，不能用 per-request 计数器，否则全是 1_）
                int seq;
                try { seq = Integer.parseInt(String.valueOf(idx)) + 1; } catch (Exception ex) { seq = loop + 1; }
                Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("name", name);
                item.put("idx", idx);
                try {
                    String whiteImgPath = String.valueOf(s.getOrDefault("whiteImgPath", ""));
                    String itemCode = String.valueOf(s.getOrDefault("itemCode", ""));
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> accParts = (List<Map<String, Object>>) s.getOrDefault("accParts", List.of());
                    // 诊断：打出每个 SKU 实际收到的配件清单，定位「配件框与 SKU 名对不上」是数据带错还是前端渲染错位
                    log.info("[生图配件] seq={} idx={} name=「{}」 accParts={}", seq, idx, name, accParts);
                    String path = imageGenService.generateSkuImage(refImagePath, name, comp, productType, batch, seq, bagImagePath, whiteImgPath, accImagePaths, waterImagePath, bgStyle, itemCode, accParts, templateId);
                    item.put("path", path);
                } catch (Exception e) {
                    item.put("error", e.getMessage());
                }
                images.add(item);
                loop++;
            }
            return ResponseEntity.ok(Map.of("images", images));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "生图失败：" + e.getMessage()));
        }
    }

    /**
     * 分析主图背景风格（整批生图前调一次，结果回传后由前端分发给每个并发 SKU，保证背景一致）。
     * 入参：{ refImagePath }  出参：{ bgStyle }
     */
    @PostMapping("/analyze-bg")
    public ResponseEntity<Map<String, Object>> analyzeBg(@RequestBody Map<String, Object> body) {
        String refImagePath = (String) body.getOrDefault("refImagePath", "");
        String bgStyle = imageGenService.analyzeBackgroundStyleOnce(refImagePath);
        return ResponseEntity.ok(Map.of("bgStyle", bgStyle == null ? "" : bgStyle));
    }

    /**
     * 启动 Playwright 自动化上新流程（异步）。
     * 入参：ListingConfig JSON，或 { loginOnly: true } 仅触发登录
     * 出参：{ taskId }
     */
    @PostMapping("/run")
    public ResponseEntity<Map<String, Object>> run(@RequestBody Map<String, Object> body) {
        try {
            boolean loginOnly = Boolean.TRUE.equals(body.get("loginOnly"));
            if (loginOnly) {
                String taskId = listingService.runLoginOnly();
                return ResponseEntity.ok(Map.of("taskId", taskId));
            }
            // 反序列化为 ListingConfig（忽略 dryRun/loginOnly 等非 config 字段）
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            om.configure(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
            ListingConfig config = om.convertValue(body, ListingConfig.class);
            boolean dryRun = Boolean.TRUE.equals(body.get("dryRun"));
            String taskId = listingService.runListing(config, dryRun);
            return ResponseEntity.ok(Map.of("taskId", taskId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "启动自动化失败：" + e.getMessage()));
        }
    }

    /**
     * 扫描商品大文件夹，自动识别子文件夹和 xlsx 定价表。
     * 入参：{ folderPath: "..." }
     * 出参：{ mainImgDir, detailImgDir, whiteImgDir, skuImgDir, excelFile, skus: [...], warnings: [...] }
     */
    @PostMapping("/scan-folder")
    public ResponseEntity<Map<String, Object>> scanFolder(@RequestBody Map<String, Object> body) {
        String folderPath = (String) body.get("folderPath");
        if (folderPath == null || folderPath.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "folderPath 不能为空"));
        }
        try {
            return ResponseEntity.ok(listingService.scanFolder(folderPath));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "扫描失败：" + e.getMessage()));
        }
    }

    /**
     * 扫描文件夹根目录下的图片，按数字顺序返回（白底图/参考图导入用）。
     * 入参：{ folderPath }  出参：{ images:[...] }
     */
    @PostMapping("/list-images")
    public ResponseEntity<Map<String, Object>> listImages(@RequestBody Map<String, Object> body) {
        String folderPath = (String) body.get("folderPath");
        if (folderPath == null || folderPath.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "folderPath 不能为空"));
        }
        try {
            return ResponseEntity.ok(Map.of("images", listingService.listImagesInFolder(folderPath)));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "扫描失败：" + e.getMessage()));
        }
    }

    /**
     * 导出 SKU 图到目标文件夹的「商品素材」子目录，按 序号_款式名.png 命名。
     * 入参：{ targetDir, skus:[{name, imgPath}] }
     * 出参：{ savedDir, count }
     */
    @PostMapping("/export-sku-images")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> exportSkuImages(@RequestBody Map<String, Object> body) {
        try {
            String targetDir = (String) body.getOrDefault("targetDir", "");
            List<Map<String, Object>> skus = (List<Map<String, Object>>) body.getOrDefault("skus", List.of());
            if (targetDir == null || targetDir.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "targetDir 不能为空"));
            }
            java.io.File dir = new java.io.File(targetDir, "商品素材");
            dir.mkdirs();
            int count = 0, seq = 1;
            for (Map<String, Object> s : skus) {
                String imgPath = String.valueOf(s.getOrDefault("imgPath", ""));
                java.io.File src = new java.io.File(imgPath);
                if (imgPath.isBlank() || !src.isFile()) { seq++; continue; }
                String name = String.valueOf(s.getOrDefault("name", "")).trim();
                String safe = name.replaceAll("[\\\\/:*?\"<>|]", "_");
                if (safe.isEmpty()) safe = "SKU";
                String ext = imgPath.toLowerCase().endsWith(".jpg") || imgPath.toLowerCase().endsWith(".jpeg") ? ".jpg" : ".png";
                java.io.File dst = new java.io.File(dir, seq + "_" + safe + ext);
                java.nio.file.Files.copy(src.toPath(), dst.toPath(),
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                count++;
                seq++;
            }
            return ResponseEntity.ok(Map.of("savedDir", dir.getAbsolutePath(), "count", count));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "导出失败：" + e.getMessage()));
        }
    }

    /**
     * 取某品类（全路径精确匹配）的产品信息预设属性。
     * GET /api/listing/product-info?category=家装主材 > 卫浴配件 > 花洒配件 > 花洒喷头
     * 出参：{ attributes: [{name, value, options:[], manual}] }
     */
    @GetMapping("/product-info")
    public ResponseEntity<Map<String, Object>> productInfo(@RequestParam(defaultValue = "") String category) {
        try {
            return ResponseEntity.ok(Map.of("attributes", listingService.productInfoFor(category)));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "读取产品信息预设失败：" + e.getMessage()));
        }
    }

    /**
     * AI 生成多套 SKU 布局和定价方案。
     * 入参：{ category, productName, brand, material, skus:[{itemCode,cost}], pricingStrategy, planCount }
     * 出参：{ plans:[{planName, description, skus:[{name,itemCode,groupPrice,singlePrice,stock}]}] }
     */
    @PostMapping("/generate-sku-plans")
    public ResponseEntity<Map<String, Object>> generateSkuPlans(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(listingService.generateSkuPlans(body));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "AI 生成方案失败：" + e.getMessage()));
        }
    }

    /**
     * 检查 Playwright 环境是否就绪（node + pdd_listing.js 是否存在）。
     */
    @GetMapping("/check")
    public ResponseEntity<Map<String, Object>> check() {
        Map<String, Object> result = new LinkedHashMap<>();
        // 检查 node 是否可用（优先打包的便携 node）
        try {
            String nodeExe = listingService.resolveNodeExe();
            Process p = new ProcessBuilder(nodeExe, "--version").redirectErrorStream(true).start();
            boolean done = p.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
            String version = done ? new String(p.getInputStream().readAllBytes()).trim() : "timeout";
            result.put("nodeVersion", version);
            result.put("nodeExe", nodeExe);
            result.put("nodeOk", done && p.exitValue() == 0);
        } catch (Exception e) {
            result.put("nodeOk", false);
            result.put("nodeError", e.getMessage());
        }
        // 检查脚本是否存在（用与实际运行一致的解析逻辑）
        java.io.File script = listingService.resolvePlaywrightScript();
        result.put("scriptExists", script != null && script.exists());
        result.put("scriptPath", script != null ? script.getAbsolutePath() : "");
        // 诊断信息
        result.put("resourcesPath", System.getProperty("app.resources-path", ""));
        result.put("userDir", System.getProperty("user.dir", ""));
        return ResponseEntity.ok(result);
    }
}
