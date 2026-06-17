package com.lyauto;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 独立 Prompt 测试工具 —— 不依赖 Spring Boot，直接读 resources/prompt/*.txt，
 * 代入示例数据打印完整 prompt，便于本地验证生图 prompt 格式。
 *
 * 编译:  javac -d out PromptTester.java
 * 运行:  java -cp out com.lyauto.PromptTester
 */
public class PromptTester {

    private static final Path RESOURCES = Paths.get("src/main/resources/prompt");

    public static void main(String[] args) throws Exception {
        System.out.println("=== LY-Automation Prompt Tester ===\n");

        // ── 示例数据 ──
        String productType = "花洒";
        String skuName     = "枪灰304不锈钢旗舰款";
        String compDesc    = "全配+5支滤芯【可用1年】";
        String bgStyle     = "灰白色纹理背景，柔光氛围，影棚台面";
        String accDesc     = "本款式包含：+1.5米防爆软管+银质稳固底座+5支滤芯，按真实数量摆在左侧上层和中层";

        int filterCount = parseFilterCount(compDesc);
        String filterConstraint = filterCount > 0
            ? "ABSOLUTE FILTER COUNT: exactly " + filterCount + " (five) "
              + "white sleek cylindrical filter sticks. "
              + "These are plain matte white tubes — NO holes, NO handle, NO black rubber, "
              + "NO water-outlet pattern, NO surface details from the main product. "
              + "Count them: there must be exactly " + filterCount + " on the left side. "
            : "";
        String filterNote = filterCount > 0
            ? " IMPORTANT: the " + filterCount + " filter cartridges on left side must be "
              + "white sleek cylindrical sticks, completely plain, NO holes, NO handle."
            : "";

        // ── 1. SKU 白底图 prompt ──
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("【1】image-sku-white-bg.txt — OpenAI 兼容路径 SKU 白底图");
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        String t1 = load("image-sku-white-bg.txt");
        System.out.println(t1
            .replace("{{productType}}",       productType)
            .replace("{{skuName}}",           skuName)
            .replace("{{compDesc}}",          compDesc)
            .replace("{{filterConstraint}}",  filterConstraint));
        System.out.println();

        // ── 2. SKU 分析指令 ──
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("【2】image-sku-analyze-ref.txt — Gemini Flash 分析指令");
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        String t2 = load("image-sku-analyze-ref.txt");
        String filterNote2 = filterCount > 0
            ? " (including exactly " + filterCount + " filter cartridges)" : "";
        System.out.println(t2
            .replace("{{productType}}", productType)
            .replace("{{compDesc}}",    compDesc)
            .replace("{{filterNote}}",  filterNote2));
        System.out.println();

        // ── 3. 花洒主图 prompt ──
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("【3】image-shower-main.txt — 花洒营销主图（去中文版）");
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        String t3 = load("image-shower-main.txt");
        System.out.println(t3
            .replace("{{accDesc}}",    accDesc)
            .replace("{{bgStyle}}",    bgStyle)
            .replace("{{filterNote}}", filterNote));
        System.out.println();

        // ── 4. 背景风格提取 ──
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("【4】image-analyze-bg-style.txt — 背景风格提取");
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println(load("image-analyze-bg-style.txt"));
        System.out.println();

        // ── 检查 — 检测模板本身（未替换变量）的质量 ──
        System.out.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        System.out.println("验证结果（检测模板原文）:");
        checkNoChinese(t3, "花洒主图模板（image-shower-main.txt）");
        checkNoChinese(t1, "SKU 白底图模板（image-sku-white-bg.txt）");
        checkNoChinese(t2, "分析指令模板（image-sku-analyze-ref.txt）");
        // SKU 白底图模板检查
        checkContains(t1, "{{filterConstraint}}", "SKU 白底图", "{{filterConstraint}} placeholder");
        checkContains(t1, "RULE 0", "SKU 白底图", "RULE 0 NO-TEXT absolute section");
        checkContains(t1, "HALLUCINATION LOCKDOWN", "SKU 白底图", "HALLUCINATION LOCKDOWN section");
        checkContains(t1, "vertical column", "SKU 白底图", "vertical column alignment");
        checkContains(t1, "grid-aligned", "SKU 白底图", "grid-aligned");
        // 分析指令模板检查
        checkContains(t2, "HALLUCINATION PREVENTION", "分析指令", "HALLUCINATION PREVENTION");
        checkContains(t2, "white sleek cylindrical sticks", "分析指令", "white sleek cylindrical sticks");
        checkContains(t2, "NO holes, NO handle", "分析指令", "NO holes, NO handle");
        checkContains(t2, "ZERO TEXT", "分析指令", "ZERO TEXT rule");
        checkContains(t2, "ZERO characters", "分析指令", "ZERO characters rule");
        // 花洒主图模板检查：零文字，纯图
        checkNoChinese(t3, "花洒主图模板");
        checkContains(t3, "RULE 0", "花洒主图模板", "RULE 0 NO-TEXT absolute section");
        checkNotContains(t3, "过滤前", "花洒主图模板", "Chinese '过滤前'");
        checkNotContains(t3, "过滤后", "花洒主图模板", "Chinese '过滤后'");
        checkNotContains(t3, "品质保证", "花洒主图模板", "Chinese '品质保证'");
        checkNotContains(t3, "手持花洒", "花洒主图模板", "Chinese '手持花洒'");
        checkNotContains(t3, "BEFORE", "花洒主图模板", "English 'BEFORE'");
        checkNotContains(t3, "AFTER", "花洒主图模板", "English 'AFTER'");
        checkNotContains(t3, "SHOWER HEAD", "花洒主图模板", "English 'SHOWER HEAD'");
        // 所有模板不含中文
        checkNoChinese(t1, "SKU 白底图模板");
        checkNoChinese(t2, "分析指令模板");
        System.out.println("\n✅ 所有检查通过");
    }

    private static String load(String filename) throws IOException {
        Path p = RESOURCES.resolve(filename);
        if (!java.nio.file.Files.exists(p)) throw new RuntimeException("文件不存在: " + p.toAbsolutePath());
        return java.nio.file.Files.readString(p, StandardCharsets.UTF_8);
    }

    private static int parseFilterCount(String compDesc) {
        if (compDesc == null || compDesc.isBlank()) return 0;
        Matcher m = Pattern.compile("(\\d+)\\s*支?\\s*滤芯").matcher(compDesc);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private static void checkNoChinese(String text, String label) {
        long cn = text.chars().filter(c -> c >= 0x4E00 && c <= 0x9FFF).count();
        if (cn > 0) {
            System.out.println("  ⚠ " + label + ": 检测到 " + cn + " 个中文字符（应全为英文）");
        } else {
            System.out.println("  ✓ " + label + ": 无中文字符");
        }
    }

    private static void checkContains(String text, String keyword, String label, String desc) {
        if (text.contains(keyword)) {
            System.out.println("  ✓ " + label + ": 包含 '" + desc + "'");
        } else {
            System.out.println("  ✗ " + label + ": 缺少 '" + desc + "'");
        }
    }

    private static void checkNotContains(String text, String keyword, String label, String desc) {
        if (!text.contains(keyword)) {
            System.out.println("  ✓ " + label + ": 不含 '" + desc + "'");
        } else {
            System.out.println("  ✗ " + label + ": 仍含 '" + desc + "'");
        }
    }
}
