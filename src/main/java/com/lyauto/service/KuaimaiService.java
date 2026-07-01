package com.lyauto.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lyauto.config.AppProperties;
import okhttp3.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.File;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class KuaimaiService {

    private static final Logger log = LoggerFactory.getLogger(KuaimaiService.class);
    private static final String GATEWAY = "https://gw.superboss.cc/router";
    private static final DateTimeFormatter TS_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    // ── 单品缓存（持久化到本地文件，不过期，手动刷新）──
    private volatile List<Map<String, Object>> skuCache = null;
    private final ExecutorService pool = Executors.newFixedThreadPool(10);

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final OkHttpClient http = new OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build();

    public KuaimaiService(AppProperties appProperties) {
        this.appProperties = appProperties;
        loadPersistedTokens();
    }

    // ── 持久化 token 到用户数据目录 ──

    private File configFile() {
        String dir = appProperties.getPaths().getUserDataDir();
        return new File(dir, "kuaimai-config.json");
    }

    private void loadPersistedTokens() {
        File f = configFile();
        if (!f.exists()) return;
        try {
            @SuppressWarnings("unchecked")
            Map<String, String> m = objectMapper.readValue(f, Map.class);
            AppProperties.Kuaimai km = appProperties.getKuaimai();
            if (m.containsKey("appKey")       && !m.get("appKey").isBlank())       km.setAppKey(m.get("appKey"));
            if (m.containsKey("appSecret")    && !m.get("appSecret").isBlank())    km.setAppSecret(m.get("appSecret"));
            if (m.containsKey("accessToken"))  km.setAccessToken(m.get("accessToken"));
            if (m.containsKey("refreshToken")) km.setRefreshToken(m.get("refreshToken"));
            if (m.containsKey("companyId"))    km.setCompanyId(m.get("companyId"));
            if (m.containsKey("appTitle"))     km.setAppTitle(m.get("appTitle"));
        } catch (Exception e) {
            log.warn("加载快麦配置失败: {}", e.getMessage());
        }
    }

    private void persistTokens(String accessToken, String refreshToken) {
        AppProperties.Kuaimai km = appProperties.getKuaimai();
        km.setAccessToken(accessToken);
        km.setRefreshToken(refreshToken);
        persistAll();
    }

    /** 把当前快麦全部配置（6 字段）写入 kuaimai-config.json，供重启后覆盖默认值。 */
    public void persistAll() {
        try {
            File f = configFile();
            f.getParentFile().mkdirs();
            AppProperties.Kuaimai km = appProperties.getKuaimai();
            Map<String, String> m = new LinkedHashMap<>();
            m.put("appKey", km.getAppKey());
            m.put("appSecret", km.getAppSecret());
            m.put("accessToken", km.getAccessToken());
            m.put("refreshToken", km.getRefreshToken());
            m.put("companyId", km.getCompanyId());
            m.put("appTitle", km.getAppTitle());
            objectMapper.writeValue(f, m);
        } catch (Exception e) {
            log.warn("持久化快麦配置失败: {}", e.getMessage());
        }
    }

    // ── 签名 HMAC-MD5 ──

    private String sign(Map<String, String> params) throws Exception {
        List<String> keys = new ArrayList<>(params.keySet());
        Collections.sort(keys);
        StringBuilder sb = new StringBuilder();
        for (String k : keys) {
            String v = params.get(k);
            if (v != null && !v.isEmpty()) {
                sb.append(k).append(v);
            }
        }
        String secret = appProperties.getKuaimai().getAppSecret();
        Mac mac = Mac.getInstance("HmacMD5");
        mac.init(new SecretKeySpec(secret.getBytes("UTF-8"), "HmacMD5"));
        byte[] bytes = mac.doFinal(sb.toString().getBytes("UTF-8"));
        StringBuilder hex = new StringBuilder();
        for (byte b : bytes) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    // ── 公共请求 ──

    @SuppressWarnings("unchecked")
    public Map<String, Object> call(String method, Map<String, String> bizParams) throws Exception {
        AppProperties.Kuaimai km = appProperties.getKuaimai();
        Map<String, String> params = new LinkedHashMap<>();
        params.put("method", method);
        params.put("appKey", km.getAppKey());
        params.put("timestamp", LocalDateTime.now().format(TS_FMT));
        params.put("version", "1.0");
        params.put("session", km.getAccessToken());
        if (bizParams != null) params.putAll(bizParams);
        params.put("sign", sign(params));

        FormBody.Builder form = new FormBody.Builder();
        params.forEach(form::add);

        Request req = new Request.Builder()
            .url(GATEWAY)
            .post(form.build())
            .build();

        try (Response resp = http.newCall(req).execute()) {
            String body = resp.body() != null ? resp.body().string() : "{}";
            if (!resp.isSuccessful()) throw new RuntimeException("快麦网关 HTTP " + resp.code() + ": " + body);
            Map<String, Object> result = objectMapper.readValue(body, Map.class);
            Boolean success = (Boolean) result.get("success");
            if (Boolean.FALSE.equals(success)) {
                String msg = (String) result.getOrDefault("msg", "未知错误");
                String code = String.valueOf(result.getOrDefault("code", ""));
                throw new RuntimeException("快麦 API 错误 [" + code + "]: " + msg);
            }
            return result;
        }
    }

    // ── 刷新 Token ──

    @SuppressWarnings("unchecked")
    public Map<String, Object> refreshToken() throws Exception {
        AppProperties.Kuaimai km = appProperties.getKuaimai();
        Map<String, String> biz = Map.of("refreshToken", km.getRefreshToken());
        Map<String, Object> result = call("open.token.refresh", biz);
        Map<String, Object> session = (Map<String, Object>) result.get("session");
        if (session != null) {
            String newAccess  = (String) session.get("accessToken");
            String newRefresh = (String) session.get("refreshToken");
            km.setAccessToken(newAccess);
            km.setRefreshToken(newRefresh);
            persistTokens(newAccess, newRefresh);
        }
        return result;
    }

    // ── 查询商品列表 ──

    @SuppressWarnings("unchecked")
    public Map<String, Object> queryProducts(int pageNo, int pageSize, String keyword) throws Exception {
        Map<String, String> biz = new LinkedHashMap<>();
        biz.put("pageNo",   String.valueOf(Math.max(1, pageNo)));
        biz.put("pageSize", String.valueOf(Math.min(200, Math.max(1, pageSize))));
        Map<String, Object> result = call("item.list.query", biz);
        // API 不支持关键词搜索，后端做标题过滤
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim().toLowerCase();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
            if (items != null) {
                List<Map<String, Object>> filtered = items.stream()
                    .filter(item -> {
                        String title = String.valueOf(item.getOrDefault("title", "")).toLowerCase();
                        String outer = String.valueOf(item.getOrDefault("outerId", "")).toLowerCase();
                        return title.contains(kw) || outer.contains(kw);
                    }).collect(java.util.stream.Collectors.toList());
                result = new java.util.LinkedHashMap<>(result);
                result.put("items", filtered);
                result.put("total", filtered.size());
            }
        }
        return result;
    }

    // ── 查询单品列表（type=7：单品，排除组合/加工品）──

    @SuppressWarnings("unchecked")
    public Map<String, Object> querySkuItems(int pageNo, int pageSize, String keyword) throws Exception {
        Map<String, String> biz = new LinkedHashMap<>();
        biz.put("pageNo",   String.valueOf(Math.max(1, pageNo)));
        biz.put("pageSize", String.valueOf(Math.min(200, Math.max(1, pageSize))));
        Map<String, Object> result = call("item.list.query", biz);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim().toLowerCase();
            List<Map<String, Object>> items = (List<Map<String, Object>>) result.get("items");
            if (items != null) {
                List<Map<String, Object>> filtered = items.stream()
                    .filter(item -> {
                        String title = String.valueOf(item.getOrDefault("title", "")).toLowerCase();
                        String outer = String.valueOf(item.getOrDefault("outerId", "")).toLowerCase();
                        return title.contains(kw) || outer.contains(kw);
                    }).collect(java.util.stream.Collectors.toList());
                result = new java.util.LinkedHashMap<>(result);
                result.put("items", filtered);
                result.put("total", filtered.size());
            }
        }
        return result;
    }

    // ── 查询单品SKU明细（成本价、重量、代发标志）──

    @SuppressWarnings("unchecked")
    public Map<String, Object> getSkuDetail(String skuOuterId) throws Exception {
        Map<String, String> biz = Map.of("skuOuterId", skuOuterId);
        Map<String, Object> result = call("erp.item.single.sku.get", biz);
        List<Map<String, Object>> itemSkus = (List<Map<String, Object>>) result.get("itemSkus");
        if (itemSkus != null && !itemSkus.isEmpty()) {
            return itemSkus.get(0);
        }
        return Map.of("skuOuterId", skuOuterId);
    }

    // ── 查询供应商报价（代发成本价，失败时返回 null）──

    @SuppressWarnings("unchecked")
    public Double getSupplierPrice(String skuOuterId) {
        try {
            Map<String, String> biz = Map.of("skuOuterIds", skuOuterId);
            Map<String, Object> result = call("erp.item.supplier.list.get", biz);
            List<Map<String, Object>> suppliers = (List<Map<String, Object>>) result.get("suppliers");
            if (suppliers != null && !suppliers.isEmpty()) {
                Object price = suppliers.get(0).get("supplierPurchasePrice");
                if (price instanceof Number) return ((Number) price).doubleValue();
            }
        } catch (Exception e) {
            log.debug("供应商报价查询失败 {}: {}", skuOuterId, e.getMessage());
        }
        return null;
    }

    // ── 并发预加载全部单品（持久化到本地文件，不过期）──

    private File skuCacheFile() {
        return new File(appProperties.getPaths().getUserDataDir(), "kuaimai-sku-cache.json");
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getAllSkuItemsCached() throws Exception {
        // 内存缓存
        if (skuCache != null) return skuCache;
        // 本地文件缓存
        File f = skuCacheFile();
        if (f.exists()) {
            try {
                List<Map<String, Object>> loaded = objectMapper.readValue(f, List.class);
                if (loaded != null && !loaded.isEmpty()) {
                    skuCache = loaded;
                    log.info("从本地文件加载快麦单品缓存，共 {} 条", loaded.size());
                    return skuCache;
                }
            } catch (Exception e) {
                log.warn("读取单品缓存文件失败: {}", e.getMessage());
            }
        }
        // 无缓存 → 在线拉取
        return reloadSkuItems();
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> reloadSkuItems() throws Exception {
        log.info("开始并发预加载快麦单品...");

        Map<String, Object> first = querySkuItems(1, 200, null);
        List<Map<String, Object>> firstItems = (List<Map<String, Object>>) first.getOrDefault("items", List.of());
        Number totalNum = (Number) first.get("total");
        int total = totalNum != null ? totalNum.intValue() : firstItems.size();
        int totalPages = (int) Math.ceil((double) total / 200);

        List<Map<String, Object>> all = Collections.synchronizedList(new ArrayList<>(firstItems));

        if (totalPages > 1) {
            List<Future<List<Map<String, Object>>>> futures = new ArrayList<>();
            for (int p = 2; p <= totalPages; p++) {
                final int page = p;
                futures.add(pool.submit(() -> {
                    try {
                        Map<String, Object> resp = querySkuItems(page, 200, null);
                        return (List<Map<String, Object>>) resp.getOrDefault("items", List.of());
                    } catch (Exception e) {
                        log.warn("预加载第{}页失败: {}", page, e.getMessage());
                        return List.of();
                    }
                }));
            }
            for (Future<List<Map<String, Object>>> fut : futures) {
                try { all.addAll(fut.get(30, TimeUnit.SECONDS)); }
                catch (Exception e) { log.warn("获取预加载结果失败: {}", e.getMessage()); }
            }
        }

        skuCache = new ArrayList<>(all);
        // 持久化到本地
        try {
            objectMapper.writeValue(skuCacheFile(), skuCache);
        } catch (Exception e) {
            log.warn("写入单品缓存文件失败: {}", e.getMessage());
        }
        log.info("快麦单品缓存完成，共 {} 条", skuCache.size());
        return skuCache;
    }

    /**
     * 从全量缓存里按 outerId 找列表项（无规格商品的成本/重量/代发标志在列表数据里）。
     * 找不到返回 null。
     */
    public Map<String, Object> getCachedItemByOuterId(String outerId) throws Exception {
        if (outerId == null || outerId.isBlank()) return null;
        for (Map<String, Object> item : getAllSkuItemsCached()) {
            if (outerId.equals(str(item.get("outerId")))) return item;
        }
        return null;
    }

    /**
     * 从全量缓存里找 title/名称含任一关键词的单品，返回 [{skuOuterId, name}]（去重）。
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> findItemsByNameKeywords(List<String> keywords) throws Exception {
        List<Map<String, Object>> all = getAllSkuItemsCached();
        List<Map<String, Object>> matched = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();

        for (Map<String, Object> item : all) {
            List<Map<String, Object>> skus = (List<Map<String, Object>>) item.get("skus");
            if (skus != null && !skus.isEmpty()) {
                for (Map<String, Object> sk : skus) {
                    String name = firstNonBlank(
                        str(sk.get("propertiesAlias")), str(sk.get("shortTitle")),
                        str(sk.get("propertiesName")), str(item.get("title")));
                    String code = str(sk.get("skuOuterId"));
                    addIfMatch(matched, seen, keywords, code, name);
                }
            } else {
                String name = firstNonBlank(str(item.get("shortTitle")), str(item.get("title")));
                String code = str(item.get("outerId"));
                addIfMatch(matched, seen, keywords, code, name);
            }
        }
        return matched;
    }

    private void addIfMatch(List<Map<String, Object>> matched, java.util.Set<String> seen,
                            List<String> keywords, String code, String name) {
        if (code == null || code.isBlank() || seen.contains(code)) return;
        for (String kw : keywords) {
            if (name != null && name.contains(kw)) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("skuOuterId", code);
                m.put("name", name);
                matched.add(m);
                seen.add(code);
                return;
            }
        }
    }

    private String str(Object o) { return o == null ? "" : o.toString(); }

    /** pdd 图床真实图片地址（排除 no_pic 占位）。 */
    private boolean isRealImg(String p) {
        return p != null && p.startsWith("http") && !p.contains("no_pic");
    }

    /**
     * 按 outerId / skuOuterId 从缓存取白底图 URL。
     * SKU 级 skuPicPath 优先，缺则回退商品级 picPath；no_pic 视为无图。无图返回 null。
     */
    @SuppressWarnings("unchecked")
    public String findWhiteImageUrl(String code) throws Exception {
        if (code == null || code.isBlank()) return null;
        for (Map<String, Object> item : getAllSkuItemsCached()) {
            List<Map<String, Object>> skus = (List<Map<String, Object>>) item.get("skus");
            if (skus != null) {
                for (Map<String, Object> sk : skus) {
                    if (code.equals(str(sk.get("skuOuterId")))) {
                        String p = str(sk.get("skuPicPath"));
                        if (isRealImg(p)) return p;
                    }
                }
            }
            if (code.equals(str(item.get("outerId")))) {
                String p = str(item.get("picPath"));
                if (isRealImg(p)) return p;
            }
        }
        return null;
    }

    private String firstNonBlank(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return "";
    }
}
