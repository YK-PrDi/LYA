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
 * 防比价构图模板库：存 userDataDir/antiprice-templates.json，前端可增删改、运行时即时生效。
 * 首次不存在时从 classpath 默认模板（prompt/antiprice-templates.json）落地一份。
 */
@Service
public class PromptTemplateService {

    private static final Logger log = LoggerFactory.getLogger(PromptTemplateService.class);
    private final AppProperties appProperties;
    private final ObjectMapper om = new ObjectMapper();

    public PromptTemplateService(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    private File templateFile() {
        return new File(appProperties.getPaths().getUserDataDir(), "antiprice-templates.json");
    }

    /**
     * 读模板库 JSON 文本；不存在则从 classpath 默认值落地后再读。
     * 版本门：若内置默认模板的 version 比运行时副本更新，自动用默认值覆盖（新版软件的模板直接生效，无需手动恢复）。
     */
    public synchronized String loadJson() {
        File f = templateFile();
        try {
            String def = PromptLoader.load("prompt/antiprice-templates.json");
            if (!f.isFile()) {
                f.getParentFile().mkdirs();
                Files.write(f.toPath(), def.getBytes(StandardCharsets.UTF_8));
                return def;
            }
            String cur = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8);
            if (versionOf(def) > versionOf(cur)) {
                // 内置模板版本更新→覆盖运行时副本（打包带新模板时自动生效）
                Files.write(f.toPath(), def.getBytes(StandardCharsets.UTF_8));
                log.info("防比价模板已升级到内置版本 {}", versionOf(def));
                return def;
            }
            return cur;
        } catch (Exception e) {
            log.warn("读取防比价模板失败，回退默认: {}", e.getMessage());
            try { return PromptLoader.load("prompt/antiprice-templates.json"); }
            catch (Exception e2) { return "{\"templates\":[]}"; }
        }
    }

    /** 解析模板 JSON 顶层 version（缺失记为 0）。 */
    private int versionOf(String json) {
        try {
            Object v = om.readValue(json, Map.class).get("version");
            return v == null ? 0 : Integer.parseInt(String.valueOf(v));
        } catch (Exception e) { return 0; }
    }

    /** 保存模板库 JSON（前端编辑后写回）。 */
    public synchronized void saveJson(String json) throws Exception {
        File f = templateFile();
        f.getParentFile().mkdirs();
        Files.write(f.toPath(), json.getBytes(StandardCharsets.UTF_8));
    }

    /** 返回模板列表（List<Map>）。失败返回空列表。 */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> listTemplates() {
        try {
            Map<String, Object> root = om.readValue(loadJson(), Map.class);
            Object t = root.get("templates");
            if (t instanceof List) return (List<Map<String, Object>>) t;
        } catch (Exception e) { log.warn("解析模板失败: {}", e.getMessage()); }
        return new java.util.ArrayList<>();
    }

    /** 按 id 取单个模板；找不到返回 null。 */
    public Map<String, Object> findById(String id) {
        if (id == null || id.isBlank()) return null;
        for (Map<String, Object> t : listTemplates()) {
            if (id.equals(String.valueOf(t.get("id")))) return t;
        }
        return null;
    }

    /**
     * 取某模板可用的基准图，优先级：
     * 1) 模板手填的 baseImg 绝对路径
     * 2) 内置基准图（classpath assets/base/<模板名>[-有配件|-无配件].png|jpg，按是否有配件+模板名匹配）
     * 3) 运行时缓存（sku-base/<templateId>.jpg，当批生成的首张）
     * 都没有返回 null（需当批生成首张作基准）。
     */
    public File resolveBaseImg(Map<String, Object> tpl) { return resolveBaseImg(tpl, true); }

    public File resolveBaseImg(Map<String, Object> tpl, boolean hasAcc) {
        if (tpl == null) return null;
        Object bi = tpl.get("baseImg");
        if (bi instanceof String && !((String) bi).isBlank()) {
            File f = new File((String) bi);
            if (f.isFile()) return f;
        }
        // 模板可设 noBuiltinBase=true 跳过内置图：当批 AI 用加强提示词重生首张作基准，再缓存复用。
        boolean skipBuiltin = Boolean.TRUE.equals(tpl.get("noBuiltinBase"));
        if (!skipBuiltin) {
            String name = String.valueOf(tpl.get("name"));
            // 先按「有配件/无配件」变体匹配，没有再退回无后缀的单图
            File builtin = builtinBaseByName(name + (hasAcc ? "-有配件" : "-无配件"));
            if (builtin == null) builtin = builtinBaseByName(name);
            if (builtin != null) return builtin;
        }
        File cache = baseCacheFile(String.valueOf(tpl.get("id")));
        return cache.isFile() ? cache : null;
    }

    /** 内置基准图：classpath assets/base/<模板名>.(png|jpg) 落地到用户目录。找不到返回 null。 */
    public File builtinBaseByName(String name) {
        if (name == null || name.isBlank()) return null;
        for (String ext : new String[]{".png", ".jpg"}) {
            String res = "assets/base/" + name + ext;
            try (java.io.InputStream is = getClass().getClassLoader().getResourceAsStream(res)) {
                if (is == null) continue;
                File f = new File(appProperties.getPaths().getUserDataDir(), "sku-base/builtin/" + name + ext);
                if (!f.isFile()) { f.getParentFile().mkdirs(); Files.write(f.toPath(), is.readAllBytes()); }
                return f;
            } catch (Exception e) { log.warn("内置基准图落地失败({}): {}", res, e.getMessage()); }
        }
        return null;
    }

    /** 拆解结构参考图（classpath assets/explode-ref.jpg），供拆解类模板锁定内部结构。 */
    public File explodeRefFile() {
        try {
            File f = new File(appProperties.getPaths().getUserDataDir(), "sku-base/explode-ref.jpg");
            if (f.isFile()) return f;
            try (java.io.InputStream is = getClass().getClassLoader().getResourceAsStream("assets/explode-ref.jpg")) {
                if (is == null) return null;
                f.getParentFile().mkdirs(); Files.write(f.toPath(), is.readAllBytes());
            }
            return f;
        } catch (Exception e) { log.warn("拆解参考图落地失败: {}", e.getMessage()); return null; }
    }

    /** 基准图缓存文件路径：userDataDir/sku-base/<templateId>.jpg */
    public File baseCacheFile(String templateId) {
        return new File(appProperties.getPaths().getUserDataDir(), "sku-base/" + templateId + ".jpg");
    }

    /** 把生成的基准图写入缓存目录，供同模板后续 SKU 复用。 */
    public void saveBaseCache(String templateId, File img) {
        try {
            File dst = baseCacheFile(templateId);
            dst.getParentFile().mkdirs();
            Files.copy(img.toPath(), dst.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        } catch (Exception e) { log.warn("基准图缓存失败({}): {}", templateId, e.getMessage()); }
    }
}
