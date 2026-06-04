package com.lyauto.controller;

import com.lyauto.model.ListingConfig;
import com.lyauto.service.ListingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/listing")
public class ListingController {

    private final ListingService listingService;

    public ListingController(ListingService listingService) {
        this.listingService = listingService;
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
            // 反序列化为 ListingConfig
            com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
            ListingConfig config = om.convertValue(body, ListingConfig.class);
            String taskId = listingService.runListing(config);
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
        // 检查脚本是否存在
        java.io.File script = new java.io.File(System.getProperty("user.dir"), "tools/pdd_listing.js");
        result.put("scriptExists", script.exists());
        result.put("scriptPath", script.getAbsolutePath());
        return ResponseEntity.ok(result);
    }
}
