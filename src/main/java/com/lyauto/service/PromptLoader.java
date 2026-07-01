package com.lyauto.service;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.File;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Map;

/**
 * 从 classpath 读取 prompt 模板文件。
 * 模板放在 src/main/resources/prompt/*.txt，打包后自动进入 classpath。
 */
public class PromptLoader {

    private PromptLoader() {}

    /**
     * 读取 classpath 下的 prompt 模板全文（UTF-8）。
     * @param resourcePath 相对 classpath 路径，如 "prompt/image-sku-white-bg.txt"
     */
    public static String load(String resourcePath) {
        try (InputStream is = PromptLoader.class.getClassLoader()
                .getResourceAsStream(resourcePath)) {
            if (is == null) {
                throw new RuntimeException("prompt 文件未找到: " + resourcePath);
            }
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("读取 prompt 失败: " + resourcePath, e);
        }
    }

    /**
     * 版本化加载 JSON 配置：classpath 版本号(_v) > userDataDir 缓存版本号时，用 classpath 覆盖缓存。
     * 这样改 classpath 配置只需把 _v +1，启动自动同步，无需手动删缓存。
     * 缓存不旧则用缓存（保留用户界面编辑）。
     * @param classpathPath classpath 路径，如 "prompt/accessory-rules.json"（必带顶层 "_v"）
     * @param userFile      userDataDir 下的缓存文件
     * @param om            ObjectMapper（读 _v 用）
     * @return 最终生效的 JSON 文本
     */
    public static String loadVersioned(String classpathPath, File userFile, ObjectMapper om) {
        String def = load(classpathPath);
        try {
            if (!userFile.isFile()) {
                userFile.getParentFile().mkdirs();
                Files.write(userFile.toPath(), def.getBytes(StandardCharsets.UTF_8));
                return def;
            }
            String cached = new String(Files.readAllBytes(userFile.toPath()), StandardCharsets.UTF_8);
            int defV = readVersion(om, def), cacheV = readVersion(om, cached);
            if (defV > cacheV) {
                Files.write(userFile.toPath(), def.getBytes(StandardCharsets.UTF_8));
                return def;
            }
            return cached;
        } catch (Exception e) {
            return def;
        }
    }

    /** 读 JSON 顶层 "_v" 整数版本号，无则 0。 */
    @SuppressWarnings("unchecked")
    private static int readVersion(ObjectMapper om, String json) {
        try {
            Object v = om.readValue(json, Map.class).get("_v");
            return v instanceof Number ? ((Number) v).intValue() : 0;
        } catch (Exception e) {
            return 0;
        }
    }
}
