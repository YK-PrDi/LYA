package com.lyauto.model;

import java.util.List;
import java.util.Map;

/**
 * 上新模式配置：前端传入的完整商品发布参数。
 */
public class ListingConfig {

    /** 商品类型：花洒 / 架类 */
    private String productType;

    /** 材质方案：碳钢 / 不锈钢 / 塑料 */
    private String material;

    /** 商品简称（AI 据此生成标题） */
    private String productName;

    /** 品牌名（可选，如 GOFU） */
    private String brand;

    /** 拼多多类目路径（如"家装主材 > 卫浴用品 > 卫浴置物架"） */
    private String category;

    /** AI 生成的商品标题（用户确认后传入） */
    private String title;

    /** SKU 列表 */
    private List<SkuItem> skus;

    /** SKU 规格类型名称，如"款式"/"型号"/"颜色"，默认款式 */
    private String skuSpecType;

    /** 主图文件夹绝对路径 */
    private String mainImgDir;

    /** 详情图文件夹绝对路径 */
    private String detailImgDir;

    /** 白底图文件夹绝对路径（可选） */
    private String whiteImgDir;

    /** 商品属性 key-value（如 {"表面工艺":"烤漆","产地":"中国大陆"}） */
    private Map<String, String> attributes;

    /** 满件折扣（如 "9.9折"） */
    private String discount;

    /** 承诺发货时间（如 "48小时发货及揽收"） */
    private String deliveryPromise;

    /** cookies 文件路径（Playwright 登录态，可选；为空时触发首次登录流程） */
    private String cookiesPath;

    // ── getters / setters ──

    public String getProductType() { return productType; }
    public void setProductType(String productType) { this.productType = productType; }

    public String getMaterial() { return material; }
    public void setMaterial(String material) { this.material = material; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public List<SkuItem> getSkus() { return skus; }
    public void setSkus(List<SkuItem> skus) { this.skus = skus; }

    public String getSkuSpecType() { return skuSpecType; }
    public void setSkuSpecType(String skuSpecType) { this.skuSpecType = skuSpecType; }

    public String getMainImgDir() { return mainImgDir; }
    public void setMainImgDir(String mainImgDir) { this.mainImgDir = mainImgDir; }

    public String getDetailImgDir() { return detailImgDir; }
    public void setDetailImgDir(String detailImgDir) { this.detailImgDir = detailImgDir; }

    public String getWhiteImgDir() { return whiteImgDir; }
    public void setWhiteImgDir(String whiteImgDir) { this.whiteImgDir = whiteImgDir; }

    public Map<String, String> getAttributes() { return attributes; }
    public void setAttributes(Map<String, String> attributes) { this.attributes = attributes; }

    public String getDiscount() { return discount; }
    public void setDiscount(String discount) { this.discount = discount; }

    public String getDeliveryPromise() { return deliveryPromise; }
    public void setDeliveryPromise(String deliveryPromise) { this.deliveryPromise = deliveryPromise; }

    public String getCookiesPath() { return cookiesPath; }
    public void setCookiesPath(String cookiesPath) { this.cookiesPath = cookiesPath; }

    // ── 内部类：SKU 项 ──

    public static class SkuItem {
        /** SKU 名称（如"奶油"） */
        private String name;
        /** SKU 图片文件夹绝对路径 */
        private String imgDir;
        /** 拼单价（分，如 9900 = 99元） */
        private int groupPrice;
        /** 单买价（分） */
        private int singlePrice;
        /** 库存 */
        private int stock;
        /** 商品编码（可选） */
        private String itemCode;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getImgDir() { return imgDir; }
        public void setImgDir(String imgDir) { this.imgDir = imgDir; }
        public int getGroupPrice() { return groupPrice; }
        public void setGroupPrice(int groupPrice) { this.groupPrice = groupPrice; }
        public int getSinglePrice() { return singlePrice; }
        public void setSinglePrice(int singlePrice) { this.singlePrice = singlePrice; }
        public int getStock() { return stock; }
        public void setStock(int stock) { this.stock = stock; }
        public String getItemCode() { return itemCode; }
        public void setItemCode(String itemCode) { this.itemCode = itemCode; }
    }
}
