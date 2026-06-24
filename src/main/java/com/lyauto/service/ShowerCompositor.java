package com.lyauto.service;

import com.lyauto.config.AppProperties;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.List;

/**
 * 花洒 SKU 图的 Java 贴图合成层（Graphics2D）。从 ImageGenService 抽出：
 * 左侧/指定区域配件卡、底部通栏、配件排布、抠白底、采样背景色、写 JPG 等。
 * 贴图模板(sticker)与纯AI模板(ai)的后处理都复用这里，避免编排类里堆叠绘图细节。
 */
@Component
public class ShowerCompositor {

    private final AppProperties appProperties;

    public ShowerCompositor(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    /** 生图输出目录：用户数据目录下 sku-gen/<batch>/ */
    private File outputDir(String batch) {
        File dir = new File(appProperties.getPaths().getUserDataDir(), "sku-gen/" + batch);
        dir.mkdirs();
        return dir;
    }

    /**
     * 花洒专属：AI 只生右侧主件+背景，左侧由本方法用白底图合成贴上。
     * 左中=一张配件卡（底座/软管/滤芯横排同卡内，底条写全部名称）；底部=全宽深色通栏写款式名。
     * 失败抛异常，由调用方降级为纯主图。
     */
    File compositeShowerLeft(File baseImg, List<File> accFiles, List<String> accLabels,
                             int filterCount, String batch, int seq, String skuName, String compDesc, File bgRef, String colorName) throws Exception {
        BufferedImage base = ImageIO.read(baseImg);
        if (base == null) throw new RuntimeException("合成读图失败");
        int W = base.getWidth(), H = base.getHeight();
        Graphics2D g = base.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

        // 底条/通栏颜色：跟随花洒颜色（colorName）；匹配不到再回退主图背景采样色
        Color bgBase = colorOfShower(colorName, bgRef, base);
        Color banner = darken(bgBase, 0.6);

        // 所有配件合并进一张卡：底座/软管各一格，滤芯按数量重复；底条写全部名称
        java.util.List<File>   showImgs = new java.util.ArrayList<>();
        java.util.List<String> txts     = new java.util.ArrayList<>();
        File filterImg = null;
        for (int i = 0; i < accFiles.size(); i++) {
            String lb = accLabels.get(i);
            if ("滤芯".equals(lb)) { filterImg = accFiles.get(i); }
            else { showImgs.add(accFiles.get(i)); txts.add(accDisplay(accFiles.get(i), lb, 0)); }
        }
        boolean hasFilter = filterImg != null && filterCount > 0;
        if (hasFilter) { for (int i = 0; i < filterCount; i++) showImgs.add(filterImg); txts.add(filterDisplay(filterCount)); }
        boolean hasCard = !showImgs.isEmpty();

        if (hasCard) {
            // 左中一张横向卡（4:3，宽>高），垂直居中，左侧留边、与右侧袋子保持间距
            int cardW = (int)(W * 0.32);
            int cardH = (int)(cardW * 3.0 / 4.0);
            int cardX = (int)(W * 0.06);
            int cardY = (H - cardH) / 2;
            drawAccCard(g, cardX, cardY, cardW, cardH, showImgs, String.join(" / ", txts), 0, banner);
        }

        // 底部全宽深色通栏：写款式名（如「一键止水花洒+1.5米软管」）
        String bottomTxt = compDesc == null ? "" : compDesc.trim();
        if (!bottomTxt.isBlank()) {
            int bh = (int)(H * 0.10);
            int by = H - bh;
            g.setColor(darken(bgBase, 0.45));
            g.fillRect(0, by, W, bh);
            drawFitText(g, bottomTxt, (int)(W * 0.04), by, (int)(W * 0.92), bh, 52, Color.WHITE);
        }

        g.dispose();
        return writeJpg(base, batch, seq, skuName);
    }

    /** 颜色按因子加深（f<1 变暗）。 */
    private static Color darken(Color c, double f) {
        return new Color((int)(c.getRed()*f), (int)(c.getGreen()*f), (int)(c.getBlue()*f));
    }

    /**
     * 按花洒颜色名给底栏/色标取一个代表色。命中颜色字即用对应 RGB；
     * 匹配不到则回退到主图背景采样色（bgColor）。用于「底栏颜色跟随花洒颜色」。
     */
    private Color colorOfShower(String colorName, File bgRef, BufferedImage fallback) {
        if (colorName != null) {
            String c = colorName;
            // 先匹配复合/特殊色名，再匹配单字色
            if (c.contains("枪灰") || c.contains("高级灰") || c.contains("灰")) return new Color(90, 92, 96);
            if (c.contains("月光银") || c.contains("银")) return new Color(170, 174, 178);
            if (c.contains("雅黑") || c.contains("黑")) return new Color(40, 41, 43);
            if (c.contains("金")) return new Color(190, 158, 96);
            if (c.contains("白")) return new Color(225, 227, 230);
            if (c.contains("蓝")) return new Color(58, 96, 150);
            if (c.contains("红")) return new Color(165, 60, 56);
            if (c.contains("绿")) return new Color(72, 120, 90);
            if (c.contains("粉")) return new Color(206, 140, 158);
            if (c.contains("紫")) return new Color(110, 84, 140);
            if (c.contains("香槟")) return new Color(196, 174, 130);
        }
        return bgColor(bgRef, fallback);  // 没匹配到颜色名→退回主图背景色
    }

    /**
     * 在 AI 出图上做确定性合成：可选配件卡（region 指定位置）+ 可选底部胶囊通栏。
     * 配件(底座/软管)+滤芯合并进同一张卡：上半区横排展示，下半区底条写「银底座 / n米银色软管 / 滤芯*N」。
     * region 支持 "right-center" / "left-bottom" / "left-mid-bottom" / "center"。bottomBanner=true 时画底部通栏（左 bannerLeft、右 bannerRight）。
     */
    File compositeAccCardAt(File baseImg, String region, List<File> accFiles, List<String> accLabels,
                            int filterCount, boolean bottomBanner, String bannerLeft, String bannerRight,
                            String batch, int seq, String skuName, File bgRef, String colorName) throws Exception {
        java.util.List<File>   items  = new java.util.ArrayList<>();
        java.util.List<String> labels = new java.util.ArrayList<>();
        File filterImg = null;
        for (int i = 0; i < accFiles.size(); i++) {
            if ("滤芯".equals(accLabels.get(i))) filterImg = accFiles.get(i);
            else { items.add(accFiles.get(i)); labels.add(accLabels.get(i)); }
        }
        boolean hasFilter = filterImg != null && filterCount > 0;
        boolean drawCard = !region.isBlank() && (!items.isEmpty() || hasFilter);
        if (!drawCard && !bottomBanner) return baseImg;  // 无事可做

        BufferedImage base = ImageIO.read(baseImg);
        if (base == null) throw new RuntimeException("配件卡合成读图失败");
        int W = base.getWidth(), H = base.getHeight();
        Graphics2D g = base.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);

        // 底条/通栏颜色：跟随花洒颜色（colorName）；匹配不到回退主图背景采样色
        Color bgBase = colorOfShower(colorName, bgRef, base);
        Color banner = darken(bgBase, 0.6);

        if (drawCard) {
            // 横向展示卡（宽 > 高，4:3）；固定尺寸，位置按 region 决定
            int cardW = (int)(W * 0.32);
            int cardH = (int)(cardW * 3.0 / 4.0);
            int cx, cy;
            // 底部通栏占底部约 14%，卡底不超过此线
            int cardBottom = (int)(H * 0.86);
            // 顶部安全线：左上文字带约占顶部 34%，卡顶不低于此线
            int topSafe = (int)(H * 0.34);
            if ("left-bottom".equals(region)) {
                cx = (int)(W * 0.05); cy = cardBottom - cardH;
            } else if ("left-mid-bottom".equals(region)) {
                cx = (int)(W * 0.05); cy = cardBottom - cardH;
            } else if ("center".equals(region)) {
                cx = (W - cardW) / 2; cy = (H - cardH) / 2;
            } else { // right-center：右侧中部偏上、尽量贴右边（避开右下人像、落在顶部文字下方）
                cx = (int)(W * 0.64); cy = (int)(H * 0.30);
            }
            // 仅夹紧位置（不改变卡尺寸）：卡顶不越安全线、卡底不压底部通栏
            if (cy < topSafe) cy = topSafe;
            if (cy + cardH > cardBottom) cy = Math.max(topSafe, cardBottom - cardH);
            java.util.List<String> txts = new java.util.ArrayList<>();
            for (int i = 0; i < items.size(); i++) txts.add(accDisplay(items.get(i), labels.get(i), 0));
            if (hasFilter) txts.add(filterDisplay(filterCount));
            java.util.List<File> drawImgs = new java.util.ArrayList<>(items);
            if (hasFilter) for (int i = 0; i < filterCount; i++) drawImgs.add(filterImg);
            drawAccCard(g, cx, cy, cardW, cardH, drawImgs, String.join(" / ", txts), 0, banner);
        }

        if (bottomBanner) {
            drawBottomBanner(g, base, bgBase, bannerLeft == null ? "" : bannerLeft,
                             bannerRight == null ? "" : bannerRight);
        }

        g.dispose();
        return writeJpg(base, batch, seq, skuName);
    }

    /**
     * 底部胶囊通栏：横跨底部，左右两色块拼接。左块用花洒色加深、右块用花洒色，写文字。
     * 文字用 drawFitText 约束在各自半区内，不超框、留缝隙。
     */
    private void drawBottomBanner(Graphics2D g, BufferedImage base, Color baseBg, String leftTxt, String rightTxt) {
        int W = base.getWidth(), H = base.getHeight();
        int bh = (int)(H * 0.10);
        int by = H - bh - (int)(H * 0.03);
        int bx = (int)(W * 0.04), bw = W - bx * 2;
        int arc = bh;  // 两端大圆角胶囊
        int mid = bx + (int)(bw * 0.42);
        Color leftC  = darken(baseBg, 0.55);
        Color rightC = baseBg;
        // 左半（含左端圆角）
        g.setColor(leftC);
        g.fillRoundRect(bx, by, mid - bx + arc, bh, arc, arc);
        // 右半（含右端圆角）
        g.setColor(rightC);
        g.fillRoundRect(mid - arc, by, bx + bw - mid + arc, bh, arc, arc);
        // 文字（白色，各自半区内自适应）
        drawFitText(g, leftTxt,  bx, by, mid - bx, bh, 56, Color.WHITE);
        drawFitText(g, rightTxt, mid, by, bx + bw - mid, bh, 56, Color.WHITE);
    }

    /** 底条/通栏代表色：优先从主图（bgRef）四角采样取均值，主图不可用则退回从生成图采样。整批用同一主图→颜色统一。 */
    private Color bgColor(File bgRef, BufferedImage fallback) {
        if (bgRef != null && bgRef.isFile()) {
            try {
                BufferedImage m = ImageIO.read(bgRef);
                if (m != null) {
                    int W = m.getWidth(), H = m.getHeight();
                    long r = 0, gg = 0, b = 0; int n = 0;
                    int[][] pts = {{(int)(W*0.06),(int)(H*0.10)},{(int)(W*0.94),(int)(H*0.10)},
                                   {(int)(W*0.06),(int)(H*0.90)},{(int)(W*0.94),(int)(H*0.90)},
                                   {(int)(W*0.5),(int)(H*0.5)}};
                    for (int[] p : pts) { int rgb = m.getRGB(p[0], p[1]); r+=(rgb>>16)&0xFF; gg+=(rgb>>8)&0xFF; b+=rgb&0xFF; n++; }
                    return new Color((int)(r/n), (int)(gg/n), (int)(b/n));
                }
            } catch (Exception ignore) {}
        }
        return sampleBgColor(fallback);
    }

    /** 单个配件→规范中文名：底座=银底座、软管=n米软管（米数取文件名）、滤芯=过滤滤芯*N。 */
    private static String accDisplay(File f, String label, int count) {
        String nm = f.getName().replaceAll("\\.[^.]+$", "");
        if ("滤芯".equals(label)) return "过滤滤芯*" + count;
        if ("软管".equals(label)) {
            String m = nm.contains("2米") ? "2" : (nm.contains("1.5") ? "1.5" : "");
            return (m.isEmpty() ? "" : m + "米") + "软管";
        }
        if ("底座".equals(label)) return "银底座";
        return label;
    }

    /** 滤芯卡底条文案：过滤滤芯*N。 */
    private static String filterDisplay(int count) { return "过滤滤芯*" + count; }

    /** 采样左侧边缘像素求平均作为背景代表色（用于横幅同色）。 */
    private Color sampleBgColor(BufferedImage img) {
        int W = img.getWidth(), H = img.getHeight();
        long r = 0, gg = 0, b = 0; int n = 0;
        int x = (int)(W * 0.02);
        for (double fy : new double[]{0.15, 0.30, 0.45, 0.60, 0.75}) {
            int y = (int)(H * fy);
            int rgb = img.getRGB(x, y);
            r += (rgb >> 16) & 0xFF; gg += (rgb >> 8) & 0xFF; b += rgb & 0xFF; n++;
        }
        if (n == 0) return new Color(120, 120, 120);
        return new Color((int)(r / n), (int)(gg / n), (int)(b / n));
    }

    /**
     * 画一张配件大卡：轻微立体阴影 + 白底圆角卡；上半区横排展示配件(抠白底)；
     * 下半区通栏底条(加深背景色)写 label；卡左侧外挂红色正圆 + 白「+」。
     * 文字大小锁死 40px（基于 1024×1024 图）。
     */
    private void drawAccCard(Graphics2D g, int x, int y, int w, int h,
                             java.util.List<File> accImgs, String label, int repeat, Color banner) throws Exception {
        int arc = (int)(Math.min(w, h) * 0.10);
        // 轻微立体阴影
        int sh = (int)(Math.min(w, h) * 0.025);
        g.setColor(new Color(0, 0, 0, 45));
        g.fillRoundRect(x + sh, y + sh, w, h, arc, arc);
        // 白底圆角卡
        g.setColor(Color.WHITE);
        g.fillRoundRect(x, y, w, h, arc, arc);

        // 底条 ~20% 卡高
        int bh = (int)(h * 0.20);
        int by = y + h - bh;
        // 配件展示区（底条以上）
        int areaY = y + (int)(h * 0.07);
        int areaH = by - areaY - (int)(h * 0.04);
        int areaX = x + (int)(w * 0.04);
        int areaW = w - (int)(w * 0.08);

        // 按图片分组：底座/软管各一组(count=1)，滤芯同图合并成一组(count=N)。每组占一个横向格。
        java.util.List<File> groupImg = new java.util.ArrayList<>();
        java.util.List<Integer> groupCnt = new java.util.ArrayList<>();
        if (repeat > 0 && !accImgs.isEmpty()) {           // 兼容旧调用：单图重复 repeat 份
            groupImg.add(accImgs.get(0)); groupCnt.add(repeat);
        } else {
            for (File f : accImgs) {
                int idx = groupImg.indexOf(f);
                if (idx >= 0) groupCnt.set(idx, groupCnt.get(idx) + 1);
                else { groupImg.add(f); groupCnt.add(1); }
            }
        }
        int groups = Math.max(1, groupImg.size());
        int slotW = areaW / groups;
        for (int gi = 0; gi < groupImg.size(); gi++) {
            BufferedImage acc = whiteToTransparent(ImageIO.read(groupImg.get(gi)));
            if (acc == null) continue;
            int slotX = areaX + gi * slotW;
            int cnt = groupCnt.get(gi);
            if (cnt <= 1) {
                // 单件（底座/软管）：填满该格、留 5% 边距
                drawImageFit(g, acc, slotX + (int)(slotW * 0.05), areaY + (int)(areaH * 0.05),
                             (int)(slotW * 0.90), (int)(areaH * 0.90));
            } else {
                // 多件（滤芯）：紧密并排，>5 支则换行叠放，组内铺满该格、几乎无间隙
                int sub = (int)Math.ceil(Math.sqrt((double) cnt));      // 每行支数 ~√n
                int rowsN = (int)Math.ceil((double) cnt / sub);
                int iw = slotW / sub, ih = areaH / rowsN;
                for (int k = 0; k < cnt; k++) {
                    int rr = k / sub, cc = k % sub;
                    drawImageFit(g, acc, slotX + cc * iw, areaY + rr * ih, iw, ih);
                }
            }
        }

        // 底条（加深背景色）+ 仅底部圆角
        g.setColor(banner);
        g.fillRoundRect(x, by, w, bh, arc, arc);
        g.fillRect(x, by, w, bh / 2);
        // 底条文字（白色微软雅黑加粗；最大 40px，超宽自动缩，留内边距，居中）
        if (label != null && !label.isBlank()) {
            drawFitText(g, label, x, by, w, bh, 40, Color.WHITE);
        }

        // 卡左侧外挂红色正圆 + 白「+」
        int d  = (int)(Math.min(w, h) * 0.16);
        int cx = x - d / 2, cyc = y + (h - d) / 2;
        g.setColor(new Color(0, 0, 0, 45));
        g.fillOval(cx + sh / 2, cyc + sh / 2, d, d);
        g.setColor(new Color(0xE0, 0x2B, 0x20));
        g.fillOval(cx, cyc, d, d);
        g.setColor(Color.WHITE);
        int stroke = Math.max(3, (int)(d * 0.10));
        int half   = (int)(d * 0.28);
        int ccx = cx + d / 2, ccy = cyc + d / 2;
        g.fillRect(ccx - half, ccy - stroke / 2, half * 2, stroke);
        g.fillRect(ccx - stroke / 2, ccy - half, stroke, half * 2);
    }

    /**
     * 在 (x,y,w,h) 框内居中绘制文字：字号从 maxFs 起，若超过框宽-内边距则逐级缩小，
     * 保证文字不超出框、且四周留缝隙。用于配件卡底条 / 底部通栏。
     */
    private void drawFitText(Graphics2D g, String text, int x, int y, int w, int h, int maxFs, Color color) {
        int padX = (int)(w * 0.08), padY = (int)(h * 0.18);
        int maxTw = w - padX * 2, maxTh = h - padY * 2;
        int fs = maxFs;
        java.awt.FontMetrics fm;
        while (fs > 10) {
            g.setFont(new Font("Microsoft YaHei", Font.BOLD, fs));
            fm = g.getFontMetrics();
            if (fm.stringWidth(text) <= maxTw && fm.getHeight() <= maxTh) break;
            fs -= 2;
        }
        fm = g.getFontMetrics();
        int tx = x + (w - fm.stringWidth(text)) / 2;
        int ty = y + (h - fm.getHeight()) / 2 + fm.getAscent();
        g.setColor(color);
        g.drawString(text, tx, ty);
    }

    /** 等比缩放把 img 贴进 (x,y,w,h) 居中区域。 */
    private void drawImageFit(Graphics2D g, BufferedImage img, int x, int y, int w, int h) {
        int iw = img.getWidth(), ih = img.getHeight();
        double scale = Math.min((double) w / iw, (double) h / ih);
        int nw = (int)(iw * scale), nh = (int)(ih * scale);
        int nx = x + (w - nw) / 2, ny = y + (h - nh) / 2;
        g.drawImage(img, nx, ny, nw, nh, null);
    }

    /** 白底转透明：RGB 三通道均 >238 的像素 alpha 置 0（去掉白底图的白背景）。 */
    private BufferedImage whiteToTransparent(BufferedImage src) {
        if (src == null) return null;
        int W = src.getWidth(), H = src.getHeight();
        BufferedImage out = new BufferedImage(W, H, BufferedImage.TYPE_INT_ARGB);
        for (int y = 0; y < H; y++) {
            for (int x = 0; x < W; x++) {
                int argb = src.getRGB(x, y);
                int r = (argb >> 16) & 0xFF, gg = (argb >> 8) & 0xFF, b = argb & 0xFF;
                if (r > 238 && gg > 238 && b > 238) out.setRGB(x, y, 0x00FFFFFF);
                else out.setRGB(x, y, argb);
            }
        }
        return out;
    }

    /** 把 BufferedImage 压成 1024 JPG 存到 sku-gen/<batch>/<seq>_<name>.jpg。 */
    private File writeJpg(BufferedImage img, String batch, int seq, String skuName) throws Exception {
        int max = 1024, w = img.getWidth(), h = img.getHeight();
        BufferedImage out;
        if (w > max || h > max) {
            double scale = Math.min((double) max / w, (double) max / h);
            int nw = (int)(w * scale), nh = (int)(h * scale);
            out = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
            Graphics2D gg = out.createGraphics();
            gg.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            gg.drawImage(img, 0, 0, nw, nh, null); gg.dispose();
        } else {
            out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
            Graphics2D gg = out.createGraphics(); gg.drawImage(img, 0, 0, null); gg.dispose();
        }
        String safe = skuName == null ? "" : skuName.trim().replaceAll("[\\\\/:*?\"<>|]", "_");
        if (safe.length() > 40) safe = safe.substring(0, 40);
        String fileName = safe.isEmpty() ? (seq + ".jpg") : (seq + "_" + safe + ".jpg");
        File dst = new File(outputDir(batch), fileName);
        javax.imageio.ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(0.9f);
        try (javax.imageio.stream.ImageOutputStream ios = ImageIO.createImageOutputStream(dst)) {
            writer.setOutput(ios);
            writer.write(null, new javax.imageio.IIOImage(out, null, null), param);
        } finally { writer.dispose(); }
        return dst;
    }
}
