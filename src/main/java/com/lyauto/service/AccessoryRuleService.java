package com.lyauto.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lyauto.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;

/**
 * 配件搭配规则库：存 userDataDir/accessory-rules.json，前端可编辑、运行时即时生效。
 * 粒度＝品类默认（byCategory）+ 主件编码覆盖（byMainCode）。
 * 全自动上新时据此把"只选了主件"扩展成"主件+配件/批量件+阶梯型号"。
 */
@Service
public class AccessoryRuleService {

    private static final Logger log = LoggerFactory.getLogger(AccessoryRuleService.class);
    private final AppProperties appProperties;
    private final ObjectMapper om = new ObjectMapper();

    public AccessoryRuleService(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    private File ruleFile() {
        return new File(appProperties.getPaths().getUserDataDir(), "accessory-rules.json");
    }

    /** 读规则库 JSON 文本；不存在则从 classpath 默认值落地。 */
    public synchronized String loadJson() {
        File f = ruleFile();
        try {
            if (!f.isFile()) {
                String def = PromptLoader.load("prompt/accessory-rules.json");
                f.getParentFile().mkdirs();
                Files.write(f.toPath(), def.getBytes(StandardCharsets.UTF_8));
                return def;
            }
            return new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("读取配件规则失败，回退默认: {}", e.getMessage());
            try { return PromptLoader.load("prompt/accessory-rules.json"); }
            catch (Exception e2) { return "{\"byCategory\":{},\"byMainCode\":{}}"; }
        }
    }

    public synchronized void saveJson(String json) throws Exception {
        File f = ruleFile();
        f.getParentFile().mkdirs();
        Files.write(f.toPath(), json.getBytes(StandardCharsets.UTF_8));
    }

    /** 取某品类的规则（主件编码有覆盖则优先）。找不到返回 null。 */
    @SuppressWarnings("unchecked")
    public Map<String, Object> ruleFor(String category, String mainCode) {
        try {
            Map<String, Object> root = om.readValue(loadJson(), Map.class);
            Map<String, Object> byMain = (Map<String, Object>) root.getOrDefault("byMainCode", Map.of());
            if (mainCode != null && byMain.get(mainCode) instanceof Map) {
                return (Map<String, Object>) byMain.get(mainCode);
            }
            Map<String, Object> byCat = (Map<String, Object>) root.getOrDefault("byCategory", Map.of());
            // 品类全路径或末级名都尝试匹配
            if (category != null) {
                if (byCat.get(category) instanceof Map) return (Map<String, Object>) byCat.get(category);
                String leaf = category.contains(">") ? category.substring(category.lastIndexOf('>') + 1).trim() : category.trim();
                if (byCat.get(leaf) instanceof Map) return (Map<String, Object>) byCat.get(leaf);
            }
        } catch (Exception e) { log.warn("解析配件规则失败: {}", e.getMessage()); }
        return null;
    }

    /** 只按品类取规则（忽略主件覆盖），用于阶梯回退。 */
    @SuppressWarnings("unchecked")
    public Map<String, Object> ruleForCategoryOnly(String category) {
        try {
            Map<String, Object> root = om.readValue(loadJson(), Map.class);
            Map<String, Object> byCat = (Map<String, Object>) root.getOrDefault("byCategory", Map.of());
            if (category != null) {
                if (byCat.get(category) instanceof Map) return (Map<String, Object>) byCat.get(category);
                String leaf = category.contains(">") ? category.substring(category.lastIndexOf('>') + 1).trim() : category.trim();
                if (byCat.get(leaf) instanceof Map) return (Map<String, Object>) byCat.get(leaf);
            }
        } catch (Exception e) { log.warn("解析品类规则失败: {}", e.getMessage()); }
        return null;
    }

    /**
     * 根据规则 + ERP 单品池，解析出该主件应搭配的配件/批量件单品 + 阶梯定义。
     * 返回 { ladders:[...](可能空), accSkus:[{itemCode,name,role,keyword,defaultQty}...] }。
     * accSkus 从 erpSkus 里按规则关键字匹配 name 得到（找不到对应单品的配件跳过）。
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> resolveForMain(String category, String mainCode,
                                              List<Map<String, Object>> erpSkus) {
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        List<Object> ladders = new java.util.ArrayList<>();
        List<Map<String, Object>> accSkus = new java.util.ArrayList<>();
        Map<String, Object> rule = ruleFor(category, mainCode);
        if (rule != null) {
            Object ld = rule.get("ladders");
            if (ld instanceof List) ladders.addAll((List<Object>) ld);
            // byMainCode 通常只给 accessories（候选），阶梯回退到品类默认
            if (ladders.isEmpty()) {
                Map<String, Object> catRule = ruleForCategoryOnly(category);
                if (catRule != null && catRule.get("ladders") instanceof List) {
                    ladders.addAll((List<Object>) catRule.get("ladders"));
                }
            }
            Object accs = rule.get("accessories");
            if (accs instanceof List) {
                for (Object a : (List<Object>) accs) {
                    if (!(a instanceof Map)) continue;
                    Map<String, Object> acc = (Map<String, Object>) a;
                    String kw = String.valueOf(acc.getOrDefault("keyword", ""));
                    String role = String.valueOf(acc.getOrDefault("role", "accessory"));
                    int defQty = acc.get("defaultQty") instanceof Number ? ((Number) acc.get("defaultQty")).intValue() : 1;
                    if (kw.isBlank()) continue;
                    // 在 ERP 单品池里按 name 含关键字找一个配件单品
                    Map<String, Object> hit = null;
                    if (erpSkus != null) {
                        for (Map<String, Object> s : erpSkus) {
                            String nm = String.valueOf(s.getOrDefault("name", s.getOrDefault("productName", "")));
                            if (nm.contains(kw)) { hit = s; break; }
                        }
                    }
                    if (hit != null) {
                        // 通用类型（供阶梯的 match 用，如 软管/底座/滤芯）
                        String type = kw.contains("软管") ? "软管" : kw.contains("底座") ? "底座" : kw.contains("滤芯") ? "滤芯" : kw;
                        // 软管去重：只保留一条，优先 1.5 米
                        if ("软管".equals(type)) {
                            boolean hasHose = accSkus.stream().anyMatch(x -> "软管".equals(x.get("type")));
                            if (hasHose) {
                                if (kw.contains("1.5")) {
                                    accSkus.removeIf(x -> "软管".equals(x.get("type")));  // 用 1.5 米替换已有
                                } else {
                                    continue;  // 已有软管且当前不是 1.5 米，跳过
                                }
                            }
                        }
                        Map<String, Object> as = new java.util.LinkedHashMap<>();
                        as.put("itemCode", hit.getOrDefault("itemCode", hit.getOrDefault("skuOuterId", "")));
                        as.put("name", hit.getOrDefault("name", hit.getOrDefault("productName", "")));
                        as.put("role", role);
                        as.put("keyword", kw);
                        as.put("type", type);
                        as.put("defaultQty", defQty);
                        accSkus.add(as);
                    } else {
                        log.info("规则配件「{}」在 ERP 单品池里未找到对应单品，跳过", kw);
                    }
                }
            }
        }
        out.put("ladders", ladders);
        out.put("accSkus", accSkus);
        return out;
    }
}
