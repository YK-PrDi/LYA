package com.lyauto.controller;

import com.lyauto.config.AppProperties;
import com.lyauto.service.KuaimaiService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/erp")
public class KuaimaiController {

    private static final Logger log = LoggerFactory.getLogger(KuaimaiController.class);
    private final KuaimaiService kuaimaiService;
    private final AppProperties appProperties;

    public KuaimaiController(KuaimaiService kuaimaiService, AppProperties appProperties) {
        this.kuaimaiService = kuaimaiService;
        this.appProperties = appProperties;
    }

    /**
     * 分页查询快麦商品列表。
     * GET /api/erp/products?page=1&size=20&keyword=花洒
     */
    @GetMapping("/products")
    public ResponseEntity<Map<String, Object>> products(
            @RequestParam(defaultValue = "1")  int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "")   String keyword) {
        try {
            return ResponseEntity.ok(kuaimaiService.queryProducts(page, size, keyword));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "查询失败：" + e.getMessage()));
        }
    }

    /**
     * 查询单品SKU明细（按 skuOuterId）。
     * GET /api/erp/product/{skuOuterId}
     */
    @GetMapping("/product/{skuOuterId}")
    public ResponseEntity<Map<String, Object>> product(@PathVariable String skuOuterId) {
        try {
            return ResponseEntity.ok(kuaimaiService.getSkuDetail(skuOuterId));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "查询失败：" + e.getMessage()));
        }
    }

    /**
     * 手动刷新快麦会话 token。
     * POST /api/erp/refresh-token
     */
    @PostMapping("/refresh-token")
    public ResponseEntity<Map<String, Object>> refreshToken() {
        try {
            return ResponseEntity.ok(kuaimaiService.refreshToken());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "刷新失败：" + e.getMessage()));
        }
    }

    /**
     * 获取当前快麦配置（appKey只读，token可更新）。
     * GET /api/erp/config
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getConfig() {
        AppProperties.Kuaimai km = appProperties.getKuaimai();
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("appKey",       km.getAppKey());
        m.put("appSecret",    km.getAppSecret());
        m.put("accessToken",  km.getAccessToken());
        m.put("refreshToken", km.getRefreshToken());
        m.put("companyId",    km.getCompanyId());
        m.put("appTitle",     km.getAppTitle());
        return ResponseEntity.ok(m);
    }

    /**
     * 更新快麦全部配置字段（用户在界面修改后保存；token 每 30 天过期需可改）。
     * POST /api/erp/config  { appKey, appSecret, accessToken, refreshToken, companyId, appTitle }
     * 只更新传入的字段；更新后持久化到 kuaimai-config.json（重启后仍生效）。
     */
    @PostMapping("/config")
    public ResponseEntity<Map<String, Object>> updateConfig(@RequestBody Map<String, String> body) {
        AppProperties.Kuaimai km = appProperties.getKuaimai();
        if (body.containsKey("appKey"))       km.setAppKey(body.get("appKey"));
        if (body.containsKey("appSecret"))    km.setAppSecret(body.get("appSecret"));
        if (body.containsKey("accessToken"))  km.setAccessToken(body.get("accessToken"));
        if (body.containsKey("refreshToken")) km.setRefreshToken(body.get("refreshToken"));
        if (body.containsKey("companyId"))    km.setCompanyId(body.get("companyId"));
        if (body.containsKey("appTitle"))     km.setAppTitle(body.get("appTitle"));
        kuaimaiService.persistAll();   // 写盘，重启后仍生效
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /**
     * 查询单品列表，支持关键词过滤。首次调用触发并发预加载（约6-10秒），之后从缓存瞬时返回。
     * GET /api/erp/sku-items?keyword=银底座
     * POST /api/erp/sku-items/refresh  — 强制刷新缓存
     */
    @GetMapping("/sku-items")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> skuItems(
            @RequestParam(defaultValue = "") String keyword) {
        try {
            List<Map<String, Object>> all = kuaimaiService.getAllSkuItemsCached();
            if (!keyword.isBlank()) {
                String kw = keyword.trim().toLowerCase();
                all = all.stream().filter(item -> {
                    String t = String.valueOf(item.getOrDefault("title", "")).toLowerCase();
                    String o = String.valueOf(item.getOrDefault("outerId", "")).toLowerCase();
                    return t.contains(kw) || o.contains(kw);
                }).sorted((a, b) -> matchRank(a, kw) - matchRank(b, kw))
                  .collect(java.util.stream.Collectors.toList());
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("items", all);
            result.put("total", all.size());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "查询失败：" + e.getMessage()));
        }
    }

    @PostMapping("/sku-items/refresh")
    public ResponseEntity<Map<String, Object>> refreshSkuCache() {
        try {
            List<Map<String, Object>> items = kuaimaiService.reloadSkuItems();
            return ResponseEntity.ok(Map.of("ok", true, "total", items.size()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "刷新失败：" + e.getMessage()));
        }
    }

    /**
     * 批量计算单品成本（含运费）。
     * POST /api/erp/calc-cost
     * 入参: { skuOuterIds: ["A001","B002"], productType: "花洒"|"架类" }
     * 出参: { items: [{skuOuterId,name,purchasePrice,weight,hasSupplier,freight,cost}], totalCost }
     */
    @PostMapping("/calc-cost")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> calcCost(@RequestBody Map<String, Object> body) {
        try {
            List<String> outerIds = (List<String>) body.getOrDefault("skuOuterIds", List.of());
            String productType    = (String) body.getOrDefault("productType", "架类");

            // 花洒品类：自动按名称补充固定包材（手喷袋/好评卡/胶纸），与已选去重
            java.util.LinkedHashSet<String> codes = new java.util.LinkedHashSet<>(outerIds);
            if ("花洒".equals(productType)) {
                try {
                    List<Map<String, Object>> packaging =
                        kuaimaiService.findItemsByNameKeywords(List.of("手喷袋", "好评卡", "胶纸"));
                    for (Map<String, Object> p : packaging) {
                        codes.add(String.valueOf(p.get("skuOuterId")));
                    }
                } catch (Exception e) { /* 补充失败不阻断 */ }
            }

            List<Map<String, Object>> items = new ArrayList<>();
            double totalCost = 0;

            for (String code : codes) {
                Map<String, Object> row = unitCost(code, productType);
                boolean fixed = isFixedCostName(String.valueOf(row.get("name")));
                row.put("isFixed", fixed);
                // 固定成本项不加运费（包材随主件发货）
                if (fixed) {
                    row.put("freight", 0.0);
                    row.put("cost", round2(toDouble(row.get("purchasePrice"))));
                }
                totalCost += toDouble(row.get("cost"));
                items.add(row);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("items",     items);
            result.put("totalCost", round2(totalCost));
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "成本计算失败：" + e.getMessage()));
        }
    }

    /**
     * 计算组合 SKU 成本。
     * POST /api/erp/calc-combo-cost
     * 入参: { productType, fixedAccessories:[{itemCode,cost}], skus:[{name, components:[{itemCode,qty,cost,weight}]}] }
     * 规则: 材料成本=Σ(组件cost×qty)+Σ固定项cost；总重=Σ(组件weight×qty)；
     *       运费=花洒?3:(总重<=0?0:阶梯)；SKU成本=材料+运费
     */
    @PostMapping("/calc-combo-cost")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> calcComboCost(@RequestBody Map<String, Object> body) {
        try {
            String productType = (String) body.getOrDefault("productType", "架类");
            List<Map<String, Object>> fixedAccessories = (List<Map<String, Object>>) body.getOrDefault("fixedAccessories", List.of());
            List<Map<String, Object>> skus = (List<Map<String, Object>>) body.getOrDefault("skus", List.of());

            // 固定包材成本（仅采购价，不含运费、不计重量），全局算一次
            double accessoryCost = 0;
            for (Map<String, Object> acc : fixedAccessories) {
                accessoryCost += toDouble(acc.get("cost"));
            }
            accessoryCost = round2(accessoryCost);

            List<Map<String, Object>> outSkus = new ArrayList<>();
            for (Map<String, Object> sku : skus) {
                String name = String.valueOf(sku.getOrDefault("name", ""));
                List<Map<String, Object>> components = (List<Map<String, Object>>) sku.getOrDefault("components", List.of());

                double materialCost = 0, totalWeight = 0;
                List<Map<String, Object>> breakdown = new ArrayList<>();
                int compIdx = 0;
                for (Map<String, Object> comp : components) {
                    String code = String.valueOf(comp.get("itemCode"));
                    int qty = Math.max(1, toInt(comp.getOrDefault("qty", 1)));
                    double unit = toDouble(comp.get("cost"));     // 材料价（核对后）
                    double w    = toDouble(comp.get("weight"));
                    // 成本异常保护：除首个主件外，配件若本身是「整支花洒/整机」（编码或名称含 单手喷/单花洒/整机）
                    // 说明被误当配件拼进了组合（如全配里多出一支花洒），记日志并不计入成本，避免拼单价离谱。
                    String cn = code + " " + String.valueOf(comp.getOrDefault("name", ""));
                    boolean isWholeShower = compIdx > 0 && (cn.contains("单手喷") || cn.contains("单花洒") || cn.contains("整机"));
                    if (isWholeShower) {
                        log.warn("组合成本保护：SKU「{}」的组件 {} 疑似整支花洒被误当配件，已不计入成本", name, code);
                    } else {
                        materialCost += unit * qty;
                        totalWeight  += w * qty;
                    }
                    compIdx++;

                    Map<String, Object> b = new LinkedHashMap<>();
                    b.put("itemCode", code);
                    b.put("qty",      qty);
                    b.put("unitCost", unit);
                    breakdown.add(b);
                }

                // 运费：组合层算一次
                double freight;
                if ("花洒".equals(productType)) {
                    freight = 3.0;
                } else if (totalWeight <= 0) {
                    freight = 0;
                } else {
                    long over = (long) Math.ceil(Math.max(0, totalWeight - 0.3) / 0.1);
                    freight = round2(2.4 + over * 0.15);
                }

                double cost = round2(materialCost + accessoryCost + freight);

                Map<String, Object> out = new LinkedHashMap<>();
                out.put("name",          name);
                out.put("cost",          cost);
                out.put("freight",       freight);
                out.put("totalWeight",   round2(totalWeight));
                out.put("accessoryCost", accessoryCost);
                out.put("breakdown",     breakdown);
                out.put("components",    components);
                out.put("stock",         sku.getOrDefault("stock", 8888));
                outSkus.add(out);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("skus", outSkus);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                .body(Map.of("error", "组合成本计算失败：" + e.getMessage()));
        }
    }

    /** 计算单个 skuOuterId 的成本（含运费）。优先用列表缓存（无规格商品成本/重量在列表里）。 */
    private Map<String, Object> unitCost(String code, String productType) {
        double purchasePrice = 0, weight = 0;
        int hasSupplier = 0;
        String name = code;

        // 优先：列表缓存（无规格商品 isSkuItem=0 的成本/重量/代发标志在这里）
        Map<String, Object> cached = null;
        try { cached = kuaimaiService.getCachedItemByOuterId(code); } catch (Exception ignore) {}
        if (cached != null) {
            purchasePrice = toDouble(cached.get("purchasePrice"));
            weight        = toDouble(cached.get("weight"));
            hasSupplier   = toInt(cached.get("hasSupplier"));
            String t = String.valueOf(cached.getOrDefault("title", code));
            if (!t.isBlank()) name = t;
        } else {
            // 降级：查规格 SKU 明细
            try {
                Map<String, Object> detail = kuaimaiService.getSkuDetail(code);
                purchasePrice = toDouble(detail.get("purchasePrice"));
                weight        = toDouble(detail.get("weight"));
                hasSupplier   = toInt(detail.get("hasSupplier"));
                name = String.valueOf(detail.getOrDefault("shortTitle",
                         detail.getOrDefault("skuOuterId", code)));
            } catch (Exception ignore) {}
        }

        // 单品成本只含材料价；运费在组合层按整个 SKU 算一次
        double cost = round2(purchasePrice);

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("skuOuterId",    code);
        row.put("name",          name);
        row.put("purchasePrice", purchasePrice);
        row.put("weight",        weight);
        row.put("hasSupplier",   hasSupplier);
        row.put("cost",          cost);
        return row;
    }

    private double toDouble(Object v) {
        if (v == null) return 0;
        if (v instanceof Number) return ((Number) v).doubleValue();
        try { return Double.parseDouble(v.toString()); } catch (Exception e) { return 0; }
    }

    private int toInt(Object v) {
        if (v == null) return 0;
        if (v instanceof Number) return ((Number) v).intValue();
        try { return Integer.parseInt(v.toString()); } catch (Exception e) { return 0; }
    }

    private double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    /** 搜索匹配优先级：精确匹配=0 > 前缀匹配=1 > 包含=2。 */
    private int matchRank(Map<String, Object> item, String kw) {
        String t = String.valueOf(item.getOrDefault("title", "")).toLowerCase();
        if (t.equals(kw)) return 0;
        if (t.startsWith(kw)) return 1;
        return 2;
    }

    /** 名称含包材关键词则为固定成本项（不进搭配布局，不加运费）。 */
    private boolean isFixedCostName(String name) {
        if (name == null) return false;
        return name.contains("手喷袋") || name.contains("好评卡")
            || name.contains("胶纸") || name.contains("纸箱");
    }
}
