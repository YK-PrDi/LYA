// 电商模式 — 品类多级树
// 结构：[{ display, children: [...] }, ...]
// 维护提示：增加叶子直接在最深层 children 里追加 { display: '名称' } 即可。
window.EC_CATEGORY_TREE = [
    { display: '搬运/仓储/物流设备', children: [
        { display: '存储设备', children: [
            { display: '仓储笼' }
        ]},
        { display: '登高设施', children: [
            { display: '登车桥' },
            { display: '高空作业平台' }
        ]},
        { display: '吊具/索具', children: [
            { display: '吊梁' },
            { display: '钢丝绳吊索' },
            { display: '绞盘' },
            { display: '拉紧器' },
            { display: '起重链条' }
        ]},
        { display: '起重搬运设备', children: [
            { display: '叉车/搬运车' },
            { display: '气动平衡器' },
            { display: '起重葫芦' },
            { display: '起重吸盘/磁性吊具' }
        ]},
        { display: '输送机械', children: [
            { display: '加料机' },
            { display: '启闭机' },
            { display: '输送机' }
        ]},
        { display: '停车场设备设施', children: [
            { display: '动力电池' }
        ]},
        { display: '专用车辆', children: [
            { display: '浮球' }
        ]}
    ]},
    { display: '橡塑材料及制品', children: [
        { display: '非金属材料及制品', children: [
            { display: '工业陶瓷' }
        ]},
        { display: '工业塑料制品', children: [
            { display: 'POM' }
        ]},
        { display: '绝缘材料', children: [
            { display: '绝缘板' },
            { display: '绝缘垫片' },
            { display: '绝缘隔离柱' }
        ]},
        { display: '塑料原料/塑料粒子', children: [
            { display: '塑料棒' },
            { display: '塑料焊条' }
        ]},
        { display: '橡胶制品', children: [
            { display: '橡胶棒' },
            { display: '橡胶管' },
            { display: '橡胶片/橡胶板' },
            { display: '橡胶气囊' }
        ]}
    ]},
    { display: '机械设备', children: [
        { display: '茶叶设备', children: [
            { display: '理条机' },
            { display: '揉捻机' },
            { display: '筛选机' }
        ]},
        { display: '粉碎设备', children: [
            { display: '工业破碎机' },
            { display: '工业砂磨机' },
            { display: '工业研磨机' }
        ]},
        { display: '工程机械/建筑机械', children: [
            { display: '打夯机' },
            { display: '打桩机' },
            { display: '工程钻机' },
            { display: '混凝土泵' },
            { display: '混凝土泵车' },
            { display: '机械铲' },
            { display: '压路机' }
        ]},
        { display: '环境污染防治设备', children: [
            { display: '消音降噪设备' }
        ]},
        { display: '机床', children: [
            { display: '机床' }
        ]},
        { display: '乳品设备', children: [
            { display: '乳化机' }
        ]},
        { display: '塑料机械', children: [
            { display: '吹膜机' },
            { display: '挤出机' },
            { display: '拉丝机' },
            { display: '硫化机' },
            { display: '造粒机' }
        ]},
        { display: '压缩机', children: [
            { display: '压缩机' }
        ]},
        { display: '制鞋机械', children: [
            { display: '制鞋机械' }
        ]}
    ]},
    { display: '床上用品', children: [
        { display: '被套', children: [
            { display: '涤纶被套' },
            { display: '混纺及其他材质被套' },
            { display: '棉被套' },
            { display: '绒被套' }
        ]},
        { display: '被子', children: [
            { display: '冰丝/凉感丝/天丝被' },
            { display: '蚕丝被' },
            { display: '大豆被' },
            { display: '棉花被' },
            { display: '牛奶绒/羊羔绒被' },
            { display: '其他化纤被' },
            { display: '驼毛被' },
            { display: '羊毛被' },
            { display: '羽绒/羽毛被' }
        ]},
        { display: '床单', children: [
            { display: '冰丝床单' },
            { display: '涤纶床单' },
            { display: '混纺及其他材质床单' },
            { display: '加绒床单' },
            { display: '老粗布床单' },
            { display: '棉床单' }
        ]},
        { display: '床垫/床褥/床护垫', children: [
            { display: '床垫' },
            { display: '床护垫' },
            { display: '床褥' },
            { display: '电热床垫' }
        ]},
        { display: '床盖', children: [
            { display: '涤纶床盖' },
            { display: '混纺及其他材质床盖' },
            { display: '棉床盖' },
            { display: '绒床盖' }
        ]},
        { display: '床笠', children: [
            { display: '冰丝床笠' },
            { display: '涤纶床笠' },
            { display: '混纺及其他材质床笠' },
            { display: '夹棉床笠' },
            { display: '棉床笠' },
            { display: '绒床笠' }
        ]},
        { display: '床幔', children: [
            { display: '床幔' }
        ]},
        { display: '床品定制/定做', children: [
            { display: '被套定制' },
            { display: '被子/被芯定制' },
            { display: '床单定制定做' },
            { display: '床垫定制定做' },
            { display: '床罩定制' },
            { display: '广告毛巾/礼品毛巾' },
            { display: '靠垫定制' },
            { display: '凉席定制定做' },
            { display: '套件定制' },
            { display: '枕套定制' },
            { display: '桌布/桌旗定制定做' }
        ]},
        { display: '床品配件', children: [
            { display: '床品配件' }
        ]},
        { display: '床品套件', children: [
            { display: '冰丝三件套/四件套/多件套' },
            { display: '蚕丝三件套/四件套/多件套' },
            { display: '涤纶三件套/四件套/多件套' },
            { display: '混纺及其他材质三件套/四件套/多件套' },
            { display: '麻三件套/四件套/多件套' },
            { display: '棉三件套/四件套/多件套' },
            { display: '绒类三件套/四件套/多件套' },
            { display: '天丝三件套/四件套/多件套' }
        ]},
        { display: '床裙', children: [
            { display: '床裙' }
        ]},
        { display: '床罩', children: [
            { display: '床罩' }
        ]},
        { display: '电热毯', children: [
            { display: '电热毯' }
        ]},
        { display: '儿童床品', children: [
            { display: '抱被/襁褓包' },
            { display: '儿童被套' },
            { display: '儿童被子' },
            { display: '儿童床单' },
            { display: '儿童床垫' },
            { display: '儿童床品套件' },
            { display: '儿童毯子' },
            { display: '儿童枕套' },
            { display: '婴童多件套' },
            { display: '婴童凉席' },
            { display: '婴童睡袋/防踢被' },
            { display: '婴童蚊帐' },
            { display: '婴童枕头/枕芯' }
        ]},
        { display: '凉席/竹席/藤席/牛皮席', children: [
            { display: '冰丝席' },
            { display: '草席' },
            { display: '棉麻凉席/牛皮席等' },
            { display: '乳胶凉席' },
            { display: '藤席' },
            { display: '竹席' }
        ]},
        { display: '其它', children: [
            { display: '其它' }
        ]},
        { display: '睡袋', children: [
            { display: '睡袋' }
        ]},
        { display: '蚊帐', children: [
            { display: '导轨蚊帐' },
            { display: '吊挂圆顶蚊帐' },
            { display: '钓鱼竿/折叠式/开门式蚊帐' },
            { display: '宫廷蚊帐' },
            { display: '拉链方帐' },
            { display: '蒙古包蚊帐' },
            { display: '蚊帐支架及配件' }
        ]},
        { display: '休闲毯/毛毯/绒毯', children: [
            { display: '法兰绒毛毯' },
            { display: '拉舍尔毛毯' },
            { display: '毛巾被/毛巾毯' },
            { display: '牛奶绒毛毯' },
            { display: '其他毛毯/绒毯' },
            { display: '珊瑚绒毛毯' }
        ]},
        { display: '一次性床品', children: [
            { display: '一次性床单' },
            { display: '一次性床品' }
        ]},
        { display: '枕巾', children: [
            { display: '枕巾' }
        ]},
        { display: '枕套', children: [
            { display: '棉枕套' },
            { display: '其他枕套' },
            { display: '绒枕套' },
            { display: '乳胶枕套' }
        ]},
        { display: '枕头/枕芯', children: [
            { display: '艾草枕' },
            { display: '蚕丝枕' },
            { display: '花草枕' },
            { display: '颈椎枕' },
            { display: '记忆棉枕' },
            { display: '决明子枕' },
            { display: '木枕' },
            { display: '荞麦枕' },
            { display: '其他枕头/枕芯' },
            { display: '乳胶枕' },
            { display: 'U型枕' },
            { display: '午睡枕' },
            { display: '纤维枕' },
            { display: '羽绒/羽毛枕' },
            { display: '玉石枕' },
            { display: '中药枕' }
        ]}
    ]},
    { display: '标准件/零部件/工业耗材', children: [
        { display: '车间保护', children: [
            { display: '绝缘垫/绝缘毯' }
        ]},
        { display: '防静电产品', children: [
            { display: '防静电板' },
            { display: '防静电垫' },
            { display: '静电发生器' }
        ]},
        { display: '管材/管件/管配件', children: [
            { display: '波纹管' },
            { display: '热缩管' }
        ]},
        { display: '机床配附件', children: [
            { display: '刀柄/刀杆' },
            { display: '顶尖/顶针' },
            { display: '防护罩' },
            { display: '分度头' },
            { display: '机床灯具' },
            { display: '卡盘' },
            { display: '连接杆' },
            { display: '排屑机' },
            { display: '皮带轮' },
            { display: '手轮' },
            { display: '丝杆' },
            { display: '拖链' },
            { display: '铣头/镗头' },
            { display: '主轴' }
        ]},
        { display: '磨具', children: [
            { display: '钢丝轮' },
            { display: '磨头' },
            { display: '砂布' },
            { display: '砂带' },
            { display: '砂轮' }
        ]},
        { display: '磨料', children: [
            { display: '抛光膏/抛光粉' }
        ]},
        { display: '气动元件/系统/装置', children: [
            { display: '气动接头' },
            { display: '气动马达' },
            { display: '气动软管' },
            { display: '气阀' },
            { display: '气缸' },
            { display: '真空发生器' },
            { display: '真空过滤器' },
            { display: '真空吸盘' }
        ]},
        { display: '通用五金配件', children: [
            { display: '斗齿' },
            { display: '光伏支架' },
            { display: '卡箍/抱箍/喉箍' },
            { display: '轴瓦' }
        ]},
        { display: '液压元件/系统/装置', children: [
            { display: '液压管件/油管' },
            { display: '液压接头' },
            { display: '液压马达/油马达' }
        ]}
    ]},
    { display: '电子/电工', children: [
        { display: '布线箱', children: [
            { display: '强电布线盒' },
            { display: '弱电布线盒' },
            { display: '手提/便携配电箱' }
        ]},
        { display: '插座', children: [
            { display: '暗装电源插座' },
            { display: '电话+电视插座' },
            { display: '电话插座' },
            { display: '电脑+电话插座' },
            { display: '电脑+电视插座' },
            { display: '电脑插座' },
            { display: '电视插座' },
            { display: '地插' },
            { display: '开关插座套装' },
            { display: '明装电源插座' },
            { display: 'USB插座/快充插座' },
            { display: '音频插座' }
        ]},
        { display: '电工配件', children: [
            { display: '保险丝' },
            { display: '电笔' },
            { display: '电度表' },
            { display: '电工胶带' },
            { display: '电视分配器' },
            { display: '汇流排' },
            { display: '接线端子' },
            { display: '其他电工配件' }
        ]},
        { display: '电工套管', children: [
            { display: '电线管' },
            { display: '电线管配件' }
        ]},
        { display: '电线', children: [
            { display: '单芯线' },
            { display: '电话线' },
            { display: '电缆线' },
            { display: '护套线' },
            { display: '视频线' },
            { display: '网络线' },
            { display: '音响线' }
        ]},
        { display: '底盒', children: [
            { display: '地插底盒' },
            { display: '底盒修复器' },
            { display: '开关/插座底盒' }
        ]},
        { display: '断路器', children: [
            { display: '空气开关' },
            { display: '漏电保护插座' },
            { display: '漏电保护器' }
        ]},
        { display: '防盗报警器材及系统', children: [
            { display: '安防配件' },
            { display: '报警主机' },
            { display: '断电报警器' },
            { display: '防盗报警器' },
            { display: '家用单机温感探测器' },
            { display: '家用气体检测报警器' },
            { display: '入侵检测设备', children: [
                { display: '红外探测器' },
                { display: '门磁探测器' },
                { display: '声磁探测器' },
                { display: '震动探测器' }
            ]},
            { display: '水浸报警器' },
            { display: '烟雾报警器' },
            { display: '智能电子脉冲围栏系统' },
            { display: '阻门报警器' }
        ]},
        { display: '监控器材及系统', children: [
            { display: '4G/5G摄像头' },
            { display: '成套监控设备' },
            { display: '监控器材配件' },
            { display: '监控摄像机', children: [
                { display: '半球形摄像机' },
                { display: '防爆摄像机' },
                { display: '仿真摄像机' },
                { display: '红外摄像机' },
                { display: '枪机' },
                { display: '球形摄像机' },
                { display: '一体化摄像机' }
            ]},
            { display: '监控显示器' },
            { display: '监控硬盘' },
            { display: '内窥镜摄像头' },
            { display: '双目/多目摄像头' },
            { display: '太阳能摄像头' },
            { display: '网络摄像机' }
        ]},
        { display: '交换器', children: [
            { display: '交换器' }
        ]},
        { display: '接线板/插头', children: [
            { display: '插头' },
            { display: '电缆盘/绕线盘/收线器' },
            { display: '轨道插座' },
            { display: '接线板/插排' },
            { display: '魔方/立式/圆盘/86型插排' },
            { display: '嵌入式插座' },
            { display: '升降插座' },
            { display: 'USB/快充排插' },
            { display: '延长线插排' },
            { display: '转换插头' }
        ]},
        { display: '开关', children: [
            { display: '按钮开关/控制器' },
            { display: '插卡取电开关' },
            { display: '触摸开关' },
            { display: '单控开关' },
            { display: '调光开关' },
            { display: '调速开关' },
            { display: '定时开关' },
            { display: '多控开关' },
            { display: '防溅盒' },
            { display: '感应开关' },
            { display: '门铃/门禁开关' },
            { display: '免布线遥控开关' },
            { display: '其他遥控开关/无线开关' },
            { display: '双控开关' },
            { display: '水泵遥控开关' },
            { display: '浴霸专用开关' },
            { display: '闸刀开关' }
        ]},
        { display: '消防报警设备', children: [
            { display: '报警按钮' },
            { display: '报警灯' },
            { display: '报警喇叭/警号' },
            { display: '报警模块' },
            { display: '壁挂广播控制柜' },
            { display: '壁挂消防广播功放' },
            { display: '回路板' },
            { display: '火灾显示盘' },
            { display: '警铃' },
            { display: '喷淋头' },
            { display: '气体灭火控制盘' },
            { display: '消防电话' },
            { display: '消防控制柜/控制箱' },
            { display: '消防稳压电源' },
            { display: '吸顶式消防广播音箱' },
            { display: '总线控制盘' }
        ]},
        { display: '智能家居系统', children: [
            { display: 'AI/智能监控摄像机' },
            { display: '车库控制系统' },
            { display: '灯光控制系统', children: [
                { display: '调光硅箱' },
                { display: '调光控制台' },
                { display: '调光面板' }
            ]},
            { display: '电器控制系统', children: [
                { display: '地暖控制面板' },
                { display: '空调控制面板' },
                { display: '新风配件' }
            ]},
            { display: '电源控制系统', children: [
                { display: '电源控制器' },
                { display: '家用场景面板' },
                { display: '人体感应开关' }
            ]},
            { display: '门窗控制器' },
            { display: '其他智能家居用品' },
            { display: '室内新风系统' },
            { display: '遥控开关' },
            { display: '影音控制系统', children: [
                { display: '背景音乐控制器' },
                { display: '背景音乐主机' },
                { display: '影音多媒体中央控制系统' }
            ]},
            { display: '智能安防报警器材' },
            { display: '智能插座' },
            { display: '智能窗帘/电动窗帘' },
            { display: '智能家居套装' },
            { display: '智能家装解决方案' },
            { display: '智能开关' },
            { display: '智能门铃/可视门铃' },
            { display: '智能中控/智能控制面板' },
            { display: '智能转换器' }
        ]},
        { display: '智能商业/楼宇系统', children: [
            { display: '电控锁' },
            { display: '电子巡更系统' },
            { display: '光端机' },
            { display: '画面分割器' },
            { display: '楼层显示器' },
            { display: '楼宇对讲设备' },
            { display: '门禁读卡器' },
            { display: '门禁机' },
            { display: '门禁智能卡' },
            { display: '排队机/叫号器' },
            { display: '视频采集卡', children: [
                { display: '软件压缩卡' },
                { display: '硬件压缩卡' }
            ]},
            { display: '视频监控测试仪' },
            { display: '视频解码器' },
            { display: '视频矩阵服务器' },
            { display: '视频转换器' },
            { display: '识音器/集音器' },
            { display: '停车场控制机/道闸' },
            { display: '硬盘录像机', children: [
                { display: 'PC式硬盘录像机' },
                { display: '嵌入式硬盘录像机' }
            ]},
            { display: '音频采集卡' },
            { display: '音频跟随器' },
            { display: '音频切换器' },
            { display: '云台' },
            { display: '字符叠加器' }
        ]},
        { display: '转换器', children: [
            { display: '电池转换器', children: [
                { display: '5号转1号' },
                { display: '5号转2号' },
                { display: '7号转5号' },
                { display: '电压转换' }
            ]},
            { display: '电源转换器' }
        ]},
    ]},
    { display: '基础建材', children: [
        { display: '板材' },
        { display: '玻璃' },
        { display: '雕花件系列' },
        { display: '防水材料' },
        { display: '隔断墙' },
        { display: '隔热材料' },
        { display: '隔音材料' },
        { display: '管材管件' },
        { display: '硅钙板' },
        { display: '胶类' },
        { display: '家用五金' },
        { display: '门窗密封条' },
        { display: '木方' },
        { display: '配件专区' },
        { display: '其他' },
        { display: '其它基础建材' },
        { display: '人造大理石' },
        { display: '沙/石', children: [
            { display: '粗沙' },
            { display: '鹅卵石' },
            { display: '石英砂' },
            { display: '细沙' },
            { display: '中沙' }
        ]},
        { display: '砂岩', children: [
            { display: '砂岩背景墙' },
            { display: '砂岩雕刻' }
        ]},
        { display: '石膏板', children: [
            { display: '防火石膏板' },
            { display: '防水石膏板' },
            { display: '普通石膏板' },
            { display: '石膏板配件' }
        ]},
        { display: '水泥', children: [
            { display: '白水泥' },
            { display: '黑水泥' },
            { display: '水泥路面修补料' }
        ]},
        { display: '天然大理石', children: [
            { display: '大理石制品' },
            { display: '啡岗纹系列' },
            { display: '黑墨玉系列' },
            { display: '爵士白系列' },
            { display: '米黄系列' },
            { display: '墨绿玉系列' },
            { display: '晚霞红系列' },
            { display: '雪花白系列' }
        ]},
        { display: '涂料（乳胶漆）', children: [
            { display: '儿童漆' },
            { display: '硅藻泥' },
            { display: '滚筒漆' },
            { display: '黑板漆' },
            { display: '肌理漆' },
            { display: '内墙白色哑光乳胶漆' },
            { display: '内墙乳胶漆' },
            { display: '特种涂料' },
            { display: '投影漆' },
            { display: '外墙乳胶漆' },
            { display: '微水泥' },
            { display: '夜光粉' },
            { display: '艺术涂料' },
            { display: '真石漆' }
        ]},
        { display: '线条', children: [
            { display: '美边线' },
            { display: '木线条' },
            { display: '石膏线条' },
            { display: '相框线条' },
            { display: '装饰线条' }
        ]},
        { display: '新型装饰材料', children: [
            { display: '护墙角' },
            { display: '金箔' },
            { display: '透光石' },
            { display: '亚克力板' },
            { display: '有机玻璃板' },
            { display: '有机玻璃棒' },
            { display: '装饰性吸音材料' }
        ]},
        { display: '阳光房/板房/附件', children: [
            { display: '钢结构阳光房' },
            { display: '铝合金阳光房' },
            { display: 'PC耐力板/阳光板' }
        ]},
        { display: '油漆', children: [
            { display: '瓷砖漆' },
            { display: '地板漆/木纹漆' },
            { display: '工业漆', children: [
                { display: '彩钢瓦翻新漆' },
                { display: '环氧漆（地坪漆）' },
                { display: '划线漆' },
                { display: '金属漆' }
            ]},
            { display: '家具修补膏' },
            { display: '金箔漆' },
            { display: '木器漆', children: [
                { display: '木蜡油' },
                { display: '水性木器漆' },
                { display: '油性木器漆' }
            ]},
            { display: '腻子粉/膏' },
            { display: '墙面修补膏/自喷漆' },
            { display: '桐油' },
            { display: '脱漆剂' },
            { display: '土漆/大漆/生漆' },
            { display: '艺术漆' },
            { display: '油漆辅料', children: [
                { display: '虫胶漆片' },
                { display: '红丹粉/铅红' },
                { display: '腻子/批嵌材料' },
                { display: '墙固/地固/界面剂' },
                { display: '清油' },
                { display: '其他油漆辅料' },
                { display: '色浆' },
                { display: '色精' },
                { display: '涂料添加剂' },
                { display: '油漆稀释剂' }
            ]},
            { display: '原子灰' }
        ]},
        { display: '智能门锁/电子锁', children: [
            { display: '智能门锁/电子锁' }
        ]},
        { display: '砖', children: [
            { display: '多孔砖' },
            { display: '红砖' },
            { display: '轻质砖' },
            { display: '透水砖' },
            { display: '砖雕' }
        ]},
    ]},
    { display: '家居饰品', children: [
        { display: '摆件', children: [
            { display: '摆件' },
            { display: '户外/庭院摆件' },
            { display: '流水摆件' },
            { display: '落地摆件' },
            { display: '祈福摆件' },
            { display: '收纳摆件' }
        ]},
        { display: '壁饰', children: [
            { display: '壁饰' },
            { display: '铁艺壁饰' }
        ]},
        { display: '创意饰品', children: [
            { display: '百变造型香皂' },
            { display: '创意礼品' },
            { display: '创意门挡' },
            { display: '搞怪杯子' },
            { display: '海螺/贝壳/珊瑚' },
            { display: '空中吊饰' },
            { display: '扭曲雕塑品' },
            { display: '女巫布艺' },
            { display: '其他' },
            { display: '太阳能娃娃' },
            { display: '幸运星/瓶' },
            { display: '椰子壳' },
            { display: '招财猫' }
        ]},
        { display: '雕刻工艺', children: [
            { display: '根雕' },
            { display: '木雕' },
            { display: '石雕' },
            { display: '炭雕' },
            { display: '玉雕' }
        ]},
        { display: '风铃及配件', children: [
            { display: '风铃及配件' }
        ]},
        { display: '工艺船', children: [
            { display: '工艺船' }
        ]},
        { display: '工艺伞', children: [
            { display: '工艺伞' }
        ]},
        { display: '工艺扇', children: [
            { display: '工艺扇' }
        ]},
        { display: '花瓶/仿真花/仿真饰品', children: [
            { display: 'DIY仿真材料' },
            { display: '仿真花/假花' },
            { display: '仿真绿植', children: [
                { display: '吊钟/马醉木' },
                { display: '仿真绿植' }
            ]},
            { display: '仿真水果' },
            { display: '仿真迎客松' },
            { display: '仿真植物盆景' },
            { display: '干花/花瓣/花包/树枝' },
            { display: '花器/花瓶', children: [
                { display: '花壶瓶' },
                { display: '花篮' },
                { display: '花盆' },
                { display: '花瓶' },
                { display: '花桶' },
                { display: '花栅栏' },
                { display: '其他花器' }
            ]},
            { display: '花束/礼盒', children: [
                { display: '干花花束' },
                { display: '松果' },
                { display: '勿忘我/勿忘草' },
                { display: '尤加利' }
            ]},
            { display: '花艺套餐' }
        ]},
        { display: '家居香薰', children: [
            { display: '倒流香' },
            { display: '灭烛剪/点火器/聪明盖/香薰配件' },
            { display: '盘香' },
            { display: '散香器' },
            { display: '蚊香盒/架' },
            { display: '香托/香座/香插' },
            { display: '香薰灯' },
            { display: '香薰炉' },
            { display: '香薰融蜡灯' },
            { display: '线香' }
        ]},
        { display: '家居钟饰/闹钟', children: [
            { display: '挂钟' },
            { display: '家居钟饰/闹钟配件' },
            { display: '立钟/落地钟' },
            { display: '台钟/闹钟' },
            { display: '座钟' }
        ]},
        { display: '家饰软装搭配套餐', children: [
            { display: '家饰软装搭配套餐' }
        ]},
        { display: '蜡烛/烛台', children: [
            { display: '电蜡烛' },
            { display: '酥油灯' },
            { display: '无味蜡烛' },
            { display: '香薰蜡烛' },
            { display: '烛台' }
        ]},
        { display: '其他工艺饰品', children: [
            { display: '其他工艺饰品' }
        ]},
        { display: '贴饰', children: [
            { display: '背景墙贴' },
            { display: '标示贴' },
            { display: '冰箱磁性贴' },
            { display: '冰箱贴纸' },
            { display: '瓷砖/玻璃贴' },
            { display: '电脑贴' },
            { display: '地贴' },
            { display: '防油贴' },
            { display: '家具贴膜' },
            { display: '静电贴' },
            { display: '开关贴' },
            { display: '马桶贴' },
            { display: '美缝贴' },
            { display: '门贴' },
            { display: '墙贴' },
            { display: '其他贴饰' },
            { display: '身高贴' },
            { display: '天花板贴' },
            { display: '衣柜贴' }
        ]},
        { display: '相框/画框/执照框', children: [
            { display: '画框' },
            { display: '相框' },
            { display: '执照框' }
        ]},
        { display: '照片/照片墙', children: [
            { display: '照片/画片' },
            { display: '照片墙' }
        ]},
        { display: '装饰挂钩', children: [
            { display: '装饰挂钩' }
        ]},
        { display: '装饰挂牌', children: [
            { display: '门牌' },
            { display: '装饰挂牌' }
        ]},
        { display: '装饰画', children: [
            { display: '版画' },
            { display: '背景墙装饰画' },
            { display: '标本类装饰画' },
            { display: '电表箱装饰画' },
            { display: 'DIY/绕线画' },
            { display: 'DIY/数字油画' },
            { display: '氛围灯画' },
            { display: '工艺画' },
            { display: '国画' },
            { display: '其他装饰画' },
            { display: '山水画' },
            { display: '书法' },
            { display: '无框画挂钟' },
            { display: '现代装饰画' },
            { display: '油画' },
            { display: '装饰海报' }
        ]},
        { display: '装饰架/装饰搁板', children: [
            { display: '装饰架/装饰搁板' }
        ]},
        { display: '装饰器皿', children: [
            { display: '储物罐' },
            { display: '果盘/果篓' },
            { display: '饰品盒' },
            { display: '阳光罐/月光罐' },
            { display: '音乐盒' },
            { display: '装饰盆' },
            { display: '装饰碗' },
            { display: '装饰烟灰缸' },
            { display: '装饰纸巾盒' },
            { display: '装饰坐盘/挂盘' }
        ]}
    ]},
    { display: '家装主材', children: [
        { display: '背景墙/工艺软包', children: [
            { display: '背景墙软包' },
            { display: '工艺软包' },
            { display: '软包墙贴' },
            { display: '榻榻米软包' },
            { display: '天花板软包' }
        ]},
        { display: '厨房', children: [
            { display: '厨房阀门系统' },
            { display: '厨房挂件', children: [
                { display: '厨房挂件套餐' },
                { display: '刀架' },
                { display: '锅盖架' },
                { display: '微波炉支架' },
                { display: '支架挂钩' },
                { display: '置物架' }
            ]},
            { display: '厨房龙头', children: [
                { display: '电热水龙头' },
                { display: '普通水龙头' }
            ]},
            { display: '厨盆/水槽', children: [
                { display: '不锈钢水槽' },
                { display: '水槽单品' },
                { display: '水槽套餐' },
                { display: '智能水槽' }
            ]},
            { display: '厨用垃圾桶' },
            { display: '高压洗杯器/水槽冲杯器' },
            { display: '米桶' },
            { display: '其他厨房配用件' },
            { display: '商用厨房', children: [
                { display: '商用厨房操作台' },
                { display: '商用厨房调料车' },
                { display: '商用厨房龙头' },
                { display: '商用厨房主材套餐' },
                { display: '商用水槽' }
            ]},
            { display: '水槽配件', children: [
                { display: '沥水板' },
                { display: '沥水篮' },
                { display: '漏水塞/水槽塞/水槽塞子' },
                { display: '水槽下水管' },
                { display: '水槽下水器' },
                { display: '水槽皂液器/水槽洗洁精按压器' }
            ]},
            { display: '碗篮/拉篮' }
        ]},
        { display: '瓷砖', children: [
            { display: '波导线' },
            { display: '玻化砖/抛光砖' },
            { display: '瓷片' },
            { display: '瓷砖背景墙' },
            { display: '瓷砖装饰附件', children: [
                { display: '地线' },
                { display: '股线' },
                { display: '花片' },
                { display: '立柱' },
                { display: '阳角线' },
                { display: '腰线' },
                { display: '转角' }
            ]},
            { display: '仿古砖' },
            { display: '花砖' },
            { display: '马赛克' },
            { display: '木纹砖' },
            { display: '抛晶砖' },
            { display: '青石板' },
            { display: '其他类瓷砖' },
            { display: '全抛釉' },
            { display: '通体砖' },
            { display: '外墙砖' },
            { display: '微晶石' },
            { display: '文化石' },
            { display: '岩板' },
            { display: '釉面砖' }
        ]},
        { display: '地板', children: [
            { display: '地板附件', children: [
                { display: '地板弹簧' },
                { display: '地板胶垫' },
                { display: '地板龙骨' },
                { display: '防潮膜（地板膜）' },
                { display: '收边条/压线条' },
                { display: '踢脚线' },
                { display: '樟木块' }
            ]},
            { display: '地板革' },
            { display: '地面保护膜' },
            { display: '防腐木地板' },
            { display: 'PVC地板', children: [
                { display: '家用PVC地板' },
                { display: '商用PVC地板' }
            ]},
            { display: '强化复合地板' },
            { display: '实木地板' },
            { display: '实木复合地板' },
            { display: 'SPC地板' },
            { display: '特殊用途地板' },
            { display: '竹地板' }
        ]},
        { display: '环保/除味/保养', children: [] },
        { display: '集成吊顶', children: [
            { display: '电器模块', children: [
                { display: '灯暖模块' },
                { display: '多功能组合电器' },
                { display: '凉霸/顶置风扇' },
                { display: '暖风模块' },
                { display: '射灯模块' }
            ]},
            { display: '蜂窝吊顶' },
            { display: '换气模块' },
            { display: '集成吊顶套餐' },
            { display: '扣板模块' },
            { display: '配件模块', children: [
                { display: '扣板吸盘' },
                { display: '龙骨' },
                { display: '收边条' },
                { display: '丝杆' },
                { display: '转接框' }
            ]},
            { display: '照明模块' }
        ]},
        { display: '晾衣架/晾衣杆', children: [
            { display: '电动晾衣架/智能晾衣架/自动晾衣机' },
            { display: '固定晾衣架' },
            { display: '晾衣架配件', children: [
                { display: '定向滑轮组' },
                { display: '定向转角' },
                { display: '顶座' },
                { display: '钢丝绳' },
                { display: '滑轮' },
                { display: '晾杆' },
                { display: '手摇器' }
            ]},
            { display: '晾衣绳' },
            { display: '升降晾衣架' },
            { display: '伸缩晾衣架' },
            { display: '隐形升降晾衣架/隐藏升降晾衣架' }
        ]},
        { display: '墙纸', children: [
            { display: '纯纸墙纸' },
            { display: '定制壁画' },
            { display: '铝箔墙纸' },
            { display: 'PVC墙纸' },
            { display: '墙布/壁布/布面墙纸' },
            { display: '其他墙纸' },
            { display: '绒面墙纸' },
            { display: '沙面墙纸（喷砂壁纸）' },
            { display: '无纺布墙纸' }
        ]},
        { display: '其他', children: [
            { display: '其他' }
        ]},
        { display: '卫浴家具', children: [
            { display: '洗衣机柜' },
            { display: '浴室边柜' },
            { display: '浴室镜' },
            { display: '浴室镜柜' },
            { display: '浴室柜' },
            { display: '浴室柜组合' },
            { display: '智能浴室镜' }
        ]},
        { display: '卫浴配件', children: [
            { display: '地漏配件', children: [
                { display: '地漏盖' },
                { display: '地漏接头' },
                { display: '地漏芯' }
            ]},
            { display: '花洒配件', children: [
                { display: '花洒底座' },
                { display: '花洒喷头' },
                { display: '花洒软管' },
                { display: '花洒支架' }
            ]},
            { display: '净身妇洗器' },
            { display: '龙头配件', children: [
                { display: '厨卫龙头配件' },
                { display: '阀芯' },
                { display: '混水阀' },
                { display: '水龙头机械臂' },
                { display: '水龙头起泡器' }
            ]},
            { display: '喷头/喷枪' },
            { display: '上下水配件', children: [
                { display: '弹跳芯' },
                { display: '防电墙' },
                { display: '进水阀' },
                { display: '进水软管' },
                { display: '其他卫浴配件' },
                { display: '生料带' },
                { display: '下水管/排水管' },
                { display: '下水器' }
            ]},
            { display: '卫浴五金套件' },
            { display: '洗面盆配件' },
            { display: '浴缸/淋浴房配件', children: [
                { display: '挡水条' },
                { display: '淋浴房配件' },
                { display: '浴缸配件' }
            ]},
            { display: '坐便器/蹲便器/小便器配件', children: [
                { display: '蹲便器堵臭器' },
                { display: '蹲便器盖板' },
                { display: '蹲便器配件' },
                { display: '法兰圈' },
                { display: '临时马桶' },
                { display: '小便器配件' },
                { display: '座便器配件' }
            ]}
        ]},
        { display: '卫浴陶瓷', children: [
            { display: '壁挂式坐便器' },
            { display: '蹲便器' },
            { display: '普通坐便盖板' },
            { display: '普通坐便器' },
            { display: '拖把池' },
            { display: '卫浴水箱' },
            { display: '小便器', children: [
                { display: '普通小便斗' },
                { display: '无水小便斗' },
                { display: '一体式感应小便斗' }
            ]},
            { display: '智能坐便盖板' },
            { display: '智能坐便器' }
        ]},
        { display: '卫浴用品', children: [
            { display: '冲水器', children: [
                { display: '感应冲水器' },
                { display: '普通冲水阀' }
            ]},
            { display: '地漏' },
            { display: '角阀' },
            { display: '淋浴房', children: [
                { display: '淋浴房底盆' },
                { display: '整体淋浴房' }
            ]},
            { display: '淋浴花洒套装' },
            { display: '商用卫浴', children: [
                { display: '擦手纸箱' },
                { display: '干发器/酒店电吹风' },
                { display: '感应龙头' },
                { display: '烘手器' },
                { display: '自动换套马桶盖' }
            ]},
            { display: '适老浴室扶手/椅凳', children: [
                { display: '浴室壁挂椅凳' },
                { display: '浴室扶手' }
            ]},
            { display: '卫浴龙头', children: [
                { display: '净身盆龙头' },
                { display: '面盆龙头' },
                { display: '拖把池龙头' },
                { display: '洗衣机龙头' },
                { display: '浴缸淋浴龙头' }
            ]},
            { display: '卫浴五金/挂件', children: [
                { display: '杯架/漱口杯' },
                { display: '电热毛巾架/浴巾架' },
                { display: '肥皂盒/皂碟' },
                { display: '挂钩/挂衣钩' },
                { display: '过滤器/净水器' },
                { display: '化妆品架' },
                { display: '卷纸器/纸巾架' },
                { display: '毛巾杆/毛巾挂' },
                { display: '毛巾环' },
                { display: '马桶刷' },
                { display: '马桶刷架' },
                { display: '美容镜' },
                { display: '卫浴五金/挂件套餐' },
                { display: '卫浴置物架' },
                { display: '浴巾架/毛巾架' },
                { display: '浴室角架' },
                { display: '皂液器' }
            ]},
            { display: '洗面盆', children: [
                { display: '半嵌入式洗脸盆' },
                { display: '挂墙式洗脸盆' },
                { display: '立柱盆' },
                { display: '盆、台一体成型式台盆' },
                { display: '台上盆' },
                { display: '台上艺术碗盆' },
                { display: '台下盆' }
            ]},
            { display: '浴缸', children: [
                { display: '按摩浴缸' },
                { display: '普通浴缸' }
            ]},
            { display: '整体卫浴套装' }
        ]},
        { display: '浴霸', children: [] }
    ]},
    { display: '居家布艺', children: [
        { display: '布艺套装' },
        { display: '餐桌布艺', children: [
            { display: '办公桌垫' },
            { display: '餐垫' },
            { display: '餐巾' },
            { display: '茶几垫' },
            { display: '电视机柜垫/餐边柜垫' },
            { display: '鞋柜垫/玄关台面垫' },
            { display: '椅套' },
            { display: '桌布/台布' },
            { display: '桌布/桌旗/桌椅套/椅垫' },
            { display: '桌旗' },
            { display: '桌椅脚套/桌脚垫' }
        ]},
        { display: '窗帘及配件', children: [
            { display: '百叶帘/折帘/罗马帘' },
            { display: '成品窗帘' },
            { display: '窗纱' },
            { display: '垂直帘/梦幻帘' },
            { display: '电动窗帘整体套装' },
            { display: '定制窗帘' },
            { display: '蜂巢帘' },
            { display: '辅料配件', children: [
                { display: '布百叶配件' },
                { display: '窗帘绑带' },
                { display: '窗帘杆' },
                { display: '窗帘轨道' },
                { display: '窗帘花边/蕾丝' },
                { display: '窗帘扣' },
                { display: '窗帘面料' },
                { display: '挂钩/挂球' },
                { display: '帘杆' },
                { display: '帘珠' },
                { display: '铅线' },
                { display: '铅坠' },
                { display: '无纺布' }
            ]},
            { display: '卷帘' },
            { display: '柜类遮挡帘' },
            { display: '全屋窗帘套餐' },
            { display: '线帘' },
            { display: '珠帘/挂帘' }
        ]},
        { display: '刺绣套件', children: [
            { display: '蜀绣' },
            { display: '苏绣' },
            { display: '湘绣' },
            { display: '粤绣' }
        ]},
        { display: '地垫', children: [
            { display: '厨房地垫' },
            { display: '客厅地垫' },
            { display: '入户地垫' },
            { display: '商用/办公/户外地垫' },
            { display: '卧室地垫' },
            { display: '浴室地垫' }
        ]},
        { display: '地毯', children: [
            { display: '婚礼地毯/庆典地毯' },
            { display: '酒店地毯/商用地毯/户外地毯/办公地毯' },
            { display: '客厅地毯/茶几毯' },
            { display: '入户地毯/玄关地毯' },
            { display: '卧室地毯/床边毯' }
        ]},
        { display: '防尘保护罩', children: [
            { display: '床头柜盖布/柜垫' },
            { display: '床头罩' },
            { display: '电话套' },
            { display: '电脑罩' },
            { display: '电视机罩/电视机盖布' },
            { display: '钢琴罩' },
            { display: '挂袋' },
            { display: '净化器罩' },
            { display: '酒瓶套' },
            { display: '开关套' },
            { display: '烤火罩' },
            { display: '空调罩' },
            { display: '门把手套' },
            { display: '暖气片罩' },
            { display: '沙发套' },
            { display: '万能盖巾' },
            { display: '微波炉罩' },
            { display: '洗衣机罩/洗衣机盖布' },
            { display: '遥控器篮' },
            { display: '遥控器套' },
            { display: '一次性防尘罩' },
            { display: '饮水机罩' }
        ]},
        { display: '纺织品填充物' },
        { display: '缝纫DIY、工具及成品', children: [
            { display: '笔' },
            { display: '布艺DIY成品' },
            { display: '尺子' },
            { display: '缝纫DIY材料套装' },
            { display: '缝纫DIY工具套装' },
            { display: '缝纫DIY配件/辅料', children: [
                { display: '布贴/补丁' },
                { display: '缝纫花边' },
                { display: '拉链' },
                { display: '拉链头' },
                { display: '魔术贴/粘扣带/固定贴' },
                { display: '纽扣' },
                { display: '其他缝纫DIY配件/辅料' },
                { display: '丝带/绸带/布带' },
                { display: '珠子/钻饰/花朵' }
            ]},
            { display: '缝纫机' },
            { display: '划粉' },
            { display: '剪刀' },
            { display: '镊子' },
            { display: '热熔胶棒' },
            { display: '热熔胶枪' },
            { display: '线' },
            { display: '绣花机' },
            { display: '针' },
            { display: '锥子' }
        ]},
        { display: '挂毯/挂布', children: [
            { display: '挂布/背景布' },
            { display: '挂毯/壁毯' }
        ]},
        { display: '海绵垫/布料/面料' },
        { display: '靠垫/抱枕', children: [
            { display: '抱枕' },
            { display: '抱枕被' },
            { display: '抱枕定制' },
            { display: '抱枕套' },
            { display: '床头靠垫' },
            { display: '沙发靠垫' },
            { display: '午睡枕/趴睡枕' },
            { display: '腰靠垫' },
            { display: '长条抱枕' }
        ]},
        { display: '毛巾/面巾', children: [
            { display: '纯棉类毛巾' },
            { display: '化纤类毛巾' },
            { display: '其他毛巾/面巾' },
            { display: '无纺布类毛巾' }
        ]},
        { display: '门帘', children: [
            { display: '布艺门帘' },
            { display: '防蚊门帘' },
            { display: '棉门帘' },
            { display: 'PVC门帘' }
        ]},
        { display: '其他/配件/DIY/缝纫', children: [
            { display: '裁剪图' },
            { display: '穿针器' },
            { display: '其他/配件/DIY/缝纫' }
        ]},
        { display: '十字绣及工具配件', children: [
            { display: '十字绣成品' },
            { display: '十字绣工具', children: [
                { display: '拆线器/拆线刀' },
                { display: '串珠针' },
                { display: '剪刀' },
                { display: '绕线板' },
                { display: '水溶笔' },
                { display: '线号签/线号贴' },
                { display: '绣绷' },
                { display: '绣架' },
                { display: '绣针' },
                { display: '针扎针插' }
            ]},
            { display: '十字绣配件', children: [
                { display: '杯垫' },
                { display: '家居用品' },
                { display: '手机链/立体绣' },
                { display: '首饰盒' },
                { display: '书签' },
                { display: '钥匙扣' },
                { display: '婴儿用品' },
                { display: '纸巾盒/纸巾套' }
            ]},
            { display: '十字绣套件' },
            { display: '线盒' },
            { display: '绣布' },
            { display: '绣线' },
            { display: '原版绣图' },
            { display: '钻石绣/钻石画' }
        ]},
        { display: '浴巾/浴袍/干发帽', children: [
            { display: '布艺蛋糕/蛋糕毛巾' },
            { display: '干发帽' },
            { display: '手帕/擦手巾' },
            { display: '一次性浴袍' },
            { display: '浴巾' },
            { display: '浴巾毛巾方巾套装' },
            { display: '浴裙/浴袍/浴衣' }
        ]},
        { display: '坐垫/椅垫/沙发垫', children: [
            { display: '美臀垫/保健坐垫' },
            { display: '飘窗垫/窗台垫' },
            { display: '蒲团' },
            { display: '沙发垫' },
            { display: '沙发巾/沙发盖布' },
            { display: '坐垫/椅垫/凳垫' },
            { display: '坐靠一体垫' }
        ]}
    ]},
    { display: '全屋定制', children: [
        { display: '窗', children: [
            { display: '防盗窗/窗防护栏' },
            { display: '门窗保暖膜' },
            { display: '平开窗' },
            { display: '其他窗' },
            { display: '纱窗' },
            { display: '推拉窗' },
            { display: '外悬窗' },
            { display: '无框阳台窗' },
            { display: '系统窗' },
            { display: '隐形防盗网' }
        ]},
        { display: '橱柜及配件', children: [
            { display: '不锈钢橱柜' },
            { display: '厨房岛台' },
            { display: '厨房空间套餐' },
            { display: '橱柜' },
            { display: '橱柜配用件', children: [
                { display: '柜体' },
                { display: '门板' },
                { display: '台面' }
            ]}
        ]},
        { display: '定制床垫', children: [
            { display: '定制床垫' },
            { display: '睡眠系统定制' }
        ]},
        { display: '定制柜类', children: [
            { display: '定制博古柜' },
            { display: '定制餐边柜' },
            { display: '定制电视柜' },
            { display: '定制酒柜' },
            { display: '定制柜门板' },
            { display: '定制入户柜' },
            { display: '定制沙发柜' },
            { display: '定制书架' },
            { display: '定制书柜' },
            { display: '定制书台' },
            { display: '定制鞋柜' },
            { display: '定制玄关柜' },
            { display: '定制杂物柜' }
        ]},
        { display: '定制衣柜', children: [
            { display: '传统定制衣柜' },
            { display: '金属衣柜/金属衣帽间' },
            { display: '整体衣柜' },
            { display: '整体衣帽间' },
            { display: '转角衣帽间' }
        ]},
        { display: '地暖/暖气片/散热器', children: [
            { display: '低温电热辐射地暖系统', children: [
                { display: '电热膜' },
                { display: '电热丝' },
                { display: '发热电缆' },
                { display: '发热膜' },
                { display: '碳晶地暖' },
                { display: '碳纤维地暖' },
                { display: '温控器' },
                { display: '远红外电热板' }
            ]},
            { display: '低温热水辐射地暖', children: [
                { display: '地暖管' },
                { display: '地暖配件' },
                { display: '地暖套餐' },
                { display: '分集水器' },
                { display: '锅炉' },
                { display: '混水中心' },
                { display: '热泵' },
                { display: '温控器' },
                { display: '壁挂炉' }
            ]},
            { display: '换热器' },
            { display: '加水斗' },
            { display: '暖气片/散热器' },
            { display: '暖气片晾衣架' },
            { display: '水暖空调' }
        ]},
        { display: '花格', children: [
            { display: '定制花格' },
            { display: '仿古门窗' }
        ]},
        { display: '家用电梯', children: [
            { display: '家用电梯' }
        ]},
        { display: '淋浴房空间', children: [
            { display: '定制淋浴房' },
            { display: '定制淋浴房拉门' },
            { display: '定制洗手柜' },
            { display: '定制洗衣机柜' },
            { display: '定制浴帘' },
            { display: '定制浴室柜' }
        ]},
        { display: '楼梯及配件', children: [
            { display: '楼梯' },
            { display: '楼梯防滑条' },
            { display: '楼梯扶手' },
            { display: '楼梯护栏' },
            { display: '楼梯立柱' },
            { display: '楼梯踏步板' },
            { display: '缩颈龙骨' }
        ]},
        { display: '门', children: [
            { display: '电动门/伸缩门' },
            { display: '防火门' },
            { display: '进户门' },
            { display: '卷帘门/挡风门' },
            { display: '门附件', children: [
                { display: '封边' },
                { display: '开门机' },
                { display: '门标配五金件' },
                { display: '门辅料' },
                { display: '门轨' },
                { display: '门配饰' },
                { display: '门扇' },
                { display: '门套/门套线' },
                { display: '门吸/门挡' },
                { display: '压条/收边条' }
            ]},
            { display: '全景门' },
            { display: '室内门' },
            { display: '庭院门' },
            { display: '移门/隔断门' },
            { display: '折叠纱门' }
        ]},
        { display: '全屋空间定制', children: [
            { display: '车库空间定制' },
            { display: '储藏室空间定制' },
            { display: '定制阳光房' },
            { display: '定制遮挡板/定制遮丑罩' },
            { display: '儿童房空间定制' },
            { display: '健身房空间定制' },
            { display: '检修口装饰' },
            { display: '酒窖空间定制' },
            { display: '客厅空间定制' },
            { display: '内遮阳/外遮阳系统定制' },
            { display: '全屋净化新风系统' },
            { display: '全屋净水系统' },
            { display: '全屋空气调节系统' },
            { display: '书房空间定制' },
            { display: '卧室空间定制' },
            { display: '阳台空间定制' },
            { display: '影音室空间定制' },
            { display: '娱乐室空间定制' }
        ]},
        { display: '榻榻米空间', children: [
            { display: '定制飘窗柜' },
            { display: '和室窗' },
            { display: '和室门' },
            { display: '暖垫/地暖垫' },
            { display: '升降桌' },
            { display: '榻榻米垫' },
            { display: '榻榻米辅料' },
            { display: '榻榻米几/桌' },
            { display: '榻榻米柜/床' },
            { display: '榻榻米椅/凳' }
        ]},
        { display: '装饰墙面', children: [
            { display: '背景墙' },
            { display: '格栅板' },
            { display: '功能背景墙' },
            { display: '集成墙板/护墙板' },
            { display: '集成墙板/护墙板附件' },
            { display: '墙面扣板' }
        ]}
    ]},
    { display: '装修设计/施工/监理', children: [
        { display: '单项安装', children: [
            { display: '单项安装' }
        ]},
        { display: '监理', children: [
            { display: '节点监理' },
            { display: '全程监理' },
            { display: '设计审核' },
            { display: '验房' },
            { display: '预算审核' }
        ]},
        { display: '家庭保维修', children: [
            { display: '家庭保维修' }
        ]},
        { display: '软装配饰', children: [
            { display: '软装配饰' }
        ]},
        { display: '装修检测治理', children: [
            { display: '装修检测治理' },
            { display: '装修污染检测', children: [
                { display: '空气质量检测' },
                { display: '石材放射检测' }
            ]},
            { display: '空气质量治理' }
        ]}
    ]},
    { display: '商业/办公家具', children: [
        { display: '办公家具', children: [
            { display: '办公柜类', children: [
                { display: '矮柜' },
                { display: '保险柜' },
                { display: '更衣柜' },
                { display: '柜子配件' },
                { display: '文件柜' }
            ]},
            { display: '办公椅', children: [
                { display: '大班椅/老板椅' },
                { display: '会议椅/会客椅' },
                { display: '接待椅' },
                { display: '培训椅' },
                { display: '前台椅/吧椅' },
                { display: '人体工学椅' },
                { display: '休闲椅' },
                { display: '椅子配件' },
                { display: '职员椅' },
                { display: '中班椅' }
            ]},
            { display: '办公桌', children: [
                { display: '办公电脑桌' },
                { display: '大班台/老板桌' },
                { display: '会议桌' },
                { display: '培训台' },
                { display: '前台/接待台' },
                { display: '演讲台' },
                { display: '阅览桌' },
                { display: '中班台' },
                { display: '桌子配件' },
                { display: '组合/屏风工作位' }
            ]},
            { display: '报刊架' },
            { display: '大板桌' },
            { display: '隔音房/静音仓' },
            { display: '公共休闲系列', children: [
                { display: '餐桌椅系列' },
                { display: '等候椅系列' },
                { display: '剧院椅系列' },
                { display: '排椅系列' },
                { display: '休闲椅系列' }
            ]},
            { display: '会客沙发/茶几', children: [
                { display: '茶几' },
                { display: '沙发' },
                { display: '沙发配件' }
            ]},
            { display: '接待台' },
            { display: '屏风隔断', children: [
                { display: '办公屏风/隔断' },
                { display: '高隔断/隔墙' }
            ]},
            { display: '钥匙箱' }
        ]},
        { display: '殡葬业家具', children: [ { display: '骨灰盒' } ]},
        { display: '仓储家具', children: [
            { display: '阁楼货架' }, { display: '模具货架' }, { display: '千层架' },
            { display: '托臂货架/悬臂货架' }, { display: '托盘/垫板' },
            { display: '网片隔断' }, { display: '物料架' }
        ]},
        { display: '餐饮/烘焙家具', children: [
            { display: '餐车' }, { display: '餐柜' }, { display: '餐盘收集车' },
            { display: '餐台脚' }, { display: '餐椅' }, { display: '餐桌' },
            { display: '调料台' }, { display: '火锅桌' }, { display: '卡座' },
            { display: '转盘' }
        ]},
        { display: '超市家具', children: [
            { display: '堆高车' }, { display: '购物车' }, { display: '购物篮' },
            { display: '寄存柜/快递柜' }, { display: '口香糖柜' }, { display: '米粮桶' },
            { display: '平板手推车/工具车' }, { display: '收银台' },
            { display: '行李柜' }, { display: '装卸车' }
        ]},
        { display: '城市/景观家具', children: [
            { display: '公共基础设施', children: [
                { display: '安检门' }, { display: '电话亭' }, { display: '公共椅' },
                { display: '公共饮水器' }, { display: '健身娱乐设施' },
                { display: '垃圾筒/烟灰皿' }, { display: '灭火箱' },
                { display: '清洁手推车' }, { display: '售报亭' },
                { display: '移动厕所' }, { display: '邮筒' }
            ]},
            { display: '交通服务设施', children: [
                { display: '候车亭' }, { display: '交通指示牌' }, { display: '路标' },
                { display: '路障' }, { display: '停车牌' }, { display: '无障碍设施' },
                { display: '自行车停放设施' }
            ]},
            { display: '美化丰富空间设施', children: [
                { display: '雕塑' }, { display: '叠水瀑布' }, { display: '花坛' },
                { display: '景观小品' }, { display: '喷泉' }
            ]},
            { display: '信息服务设施', children: [
                { display: '布告栏' }, { display: '导向牌' }, { display: '灯箱' },
                { display: '广告牌' }, { display: '广告旗杆' }, { display: '广告帐蓬' },
                { display: '户外旗杆' }, { display: '拉网架' }, { display: 'L展架' },
                { display: '信息张贴栏' }, { display: '宣传栏' },
                { display: 'X展架/易拉宝' }, { display: '杂志报刊架' }
            ]}
        ]},
        { display: '成套家具', children: [ { display: '成套家具' } ]},
        { display: '发廊/美容家具', children: [
            { display: '大工椅/师傅椅' }, { display: '工具车' }, { display: '理发镜台' },
            { display: '毛巾柜' }, { display: '美发椅' }, { display: '美发转灯' },
            { display: '美甲台' }, { display: '美容/美发床' }, { display: '美容/美甲沙发' }
        ]},
        { display: '服装店家具', children: [
            { display: '裁剪人台' }, { display: '吊环' }, { display: '服装标签' },
            { display: '服装模特' }, { display: '服装展示架' }, { display: '挂钩' },
            { display: '试鞋凳' }, { display: '移动试衣间' }, { display: '展示地台/底座' }
        ]},
        { display: '果蔬/生鲜家具', children: [
            { display: '蔬菜架' }, { display: '蔬菜篮/水果篮' }, { display: '水果架' }
        ]},
        { display: '货架/展柜', children: [
            { display: '安全套架' }, { display: '仓储货架' }, { display: '超市货架' },
            { display: '促销架/促销车' }, { display: '服装货架' }, { display: '红酒架/柜' },
            { display: '货架附件' }, { display: '精品展柜/陈列柜' },
            { display: '冷冻食品架/柜' }, { display: '面包架' }, { display: '内衣货架' },
            { display: '生鲜恒温架/柜' }, { display: '饰品架/柜' },
            { display: '图书音像货架' }, { display: '五金工具货架' },
            { display: '鞋货架' }, { display: '眼镜货架' }
        ]},
        { display: '酒店家具', children: [
            { display: '大堂行李车' }, { display: '酒店单间/标间/成套家具' },
            { display: '酒店沙发' }, { display: '酒店行李柜' }, { display: '酒店桌椅' },
            { display: '客房服务车/布草车' }
        ]},
        { display: '美妆家具', children: [
            { display: '化妆品货架' }, { display: '化妆品展柜' }
        ]},
        { display: '母婴家具', children: [
            { display: '母婴货架' }, { display: '母婴货柜' }
        ]},
        { display: '其他', children: [ { display: '其他' } ]},
        { display: '桑拿/足浴/健身家具', children: [
            { display: '沐浴桶' }, { display: '桑拿手牌' }, { display: '桑拿水疗床' },
            { display: '移动汗蒸房' }, { display: '足浴/桑拿沙发' }, { display: '足浴盆' }
        ]},
        { display: '图书馆/书店/音像家具', children: [ { display: '阅览桌' } ]},
        { display: '网咖家具', children: [
            { display: '电竞太空舱' }, { display: '电竞椅' }, { display: '网咖桌' }
        ]},
        { display: '文具家具', children: [ { display: '文具货架' } ]},
        { display: '五金/建材家具', children: [ { display: '瓷砖/地板展架' } ]},
        { display: '校园教学家具', children: [
            { display: '黑板' }, { display: '护理屏风' }, { display: '课桌椅' },
            { display: '实验柜' }, { display: '实验台' }, { display: '演讲台' }
        ]},
        { display: '烟酒茶家具', children: [ { display: '烟酒柜' } ]},
        { display: '医院/药店/复健家具', children: [
            { display: '病历柜/病历柜车' }, { display: '导诊台/护士台' },
            { display: '复健椅' }, { display: '固定椅' }, { display: '器械柜' },
            { display: '试剂架' }, { display: '输液椅' }, { display: '药店展柜' },
            { display: '医药架' }, { display: '中药柜' }, { display: '助行器' },
            { display: '坐便椅' }
        ]},
        { display: '娱乐/酒吧/KTV家具', children: [
            { display: '酒吧凳/酒吧椅' }, { display: '酒吧台' },
            { display: '卡座' }, { display: '跳舞台' }
        ]},
        { display: '早教/培训家具', children: [
            { display: '学前班桌椅' }, { display: '早教中心前台' }
        ]},
        { display: '政务家具', children: [
            { display: '密集柜' }, { display: '审讯/审判椅' }, { display: '审讯/审判桌' }
        ]}
    ]},
    { display: '特色手工艺', children: [
        { display: '地区民间特色手工艺', children: [
            { display: '布老虎' }, { display: '刺绣' },
            { display: '刀剑相关', children: [
                { display: '刀剑' }, { display: '刀剑保养品' }, { display: '剑袋' }, { display: '剑架/剑托' }
            ]},
            { display: '非遗手工艺' }, { display: '风筝' }, { display: '葫芦' }, { display: '剪纸' },
            { display: '景泰蓝' }, { display: '绢人' }, { display: '空竹' }, { display: '蜡染印染' },
            { display: '脸谱' }, { display: '木偶' }, { display: '内画鼻烟壶' }, { display: '年画' },
            { display: '泥人/泥塑/面塑' }, { display: '皮影' }, { display: '青花瓷' }, { display: '漆器' },
            { display: '其他' }, { display: '梳子/梳篦' }, { display: '唐卡' }, { display: '铁画' },
            { display: '中国结' }, { display: '竹编/竹雕' }, { display: '竹筒' }
        ]},
        { display: '海外工艺品', children: [
            { display: '埃及特色' }, { display: '巴基斯坦特色' }, { display: '北欧特色' },
            { display: '波西米亚特色' }, { display: '俄罗斯特色' }, { display: '其他国家特色' },
            { display: '泰国特色' }, { display: '印度特色' }, { display: '越南特色' }
        ]},
        { display: '其他特色工艺品', children: [ { display: '其他特色工艺品' } ]},
        { display: '少数民族特色工艺品', children: [
            { display: '阿昌族' },
            { display: '白族特色', children: [
                { display: '白族草编工艺' }, { display: '白族木雕' }, { display: '白族扎染' }, { display: '其他' }
            ]},
            { display: '保安族' }, { display: '布朗族' }, { display: '布依族' }, { display: '朝鲜族' },
            { display: '傣族' }, { display: '达斡尔族' }, { display: '德昂族' }, { display: '东乡族' },
            { display: '侗族' }, { display: '独龙族' }, { display: '鄂伦春族' }, { display: '俄罗斯族' },
            { display: '鄂温克族' }, { display: '高山族' }, { display: '仡佬族' }, { display: '哈萨克族' },
            { display: '赫哲族' }, { display: '回族' }, { display: '景颇族' }, { display: '京族' },
            { display: '基诺族' }, { display: '拉祜族' }, { display: '傈僳族' }, { display: '黎族' },
            { display: '珞巴族' }, { display: '满族' }, { display: '毛南族' }, { display: '门巴族' },
            { display: '蒙古族特色', children: [
                { display: '蒙古皮画' }, { display: '蒙古碗' }, { display: '蒙古族别致腰带' },
                { display: '蒙古族鼻烟壶' }, { display: '蒙古族佩饰' }, { display: '蒙古族皮囊酒壶' },
                { display: '蒙古族竹雕画' }, { display: '其他' }
            ]},
            { display: '苗族特色', children: [
                { display: '苗族剪纸' }, { display: '苗族蜡染' }, { display: '苗族马尾斗笠' },
                { display: '苗族泥哨' }, { display: '苗族挑花' }, { display: '苗族银饰' },
                { display: '苗族长角帽' }, { display: '苗族织锦' }, { display: '其他' }
            ]},
            { display: '纳西族' }, { display: '怒族' }, { display: '普米族' }, { display: '撒拉族' },
            { display: '畲族' }, { display: '水族' }, { display: '塔吉克族' }, { display: '土家族' },
            { display: '土族' }, { display: '佤族' }, { display: '维吾尔族' }, { display: '乌孜别克族' },
            { display: '锡伯族' }, { display: '彝族' }, { display: '裕固族' },
            { display: '藏族特色', children: [
                { display: '其他' }, { display: '西藏古代铜雕' }, { display: '藏族贲巴壶' },
                { display: '藏族哈达' }, { display: '藏族绘画' }, { display: '藏族曼扎盘' }, { display: '藏族唐卡' }
            ]},
            { display: '壮族特色', children: [
                { display: '铜鼓' }, { display: '壮锦' }, { display: '壮绣' },
                { display: '壮族儿帽' }, { display: '壮族花山崖壁画' }
            ]}
        ]},
        { display: '宗教工艺品', children: [
            { display: '道教工艺品' }, { display: '佛教工艺品' },
            { display: '佛珠/念珠', children: [
                { display: '佛珠挂链' }, { display: '佛珠手链' }, { display: '佛珠项链' }
            ]},
            { display: '基督教工艺品' }, { display: '其他宗教工艺品' }, { display: '伊斯兰教工艺品' }
        ]}
    ]},
    { display: '五金工具', children: [
        { display: '安全检查设备', children: [
            { display: '车底检查镜' }, { display: '红外线测温系统/测温门' },
            { display: '金属探测器' }, { display: '无线电波探测仪' }
        ]},
        { display: '测量工具' },
        { display: '传动件' },
        { display: '电动工具' },
        { display: '电气控制', children: [
            { display: '变流器/整流器' },
            { display: '变频器', children: [
                { display: '通用变频器' }, { display: '专用变频器' }
            ]},
            { display: '变压器', children: [
                { display: '船用变压器' }, { display: '电力变压器' }, { display: '电炉变压器' },
                { display: '电源变压器' }, { display: '电子变压器' }, { display: '调压变压器' },
                { display: '隔离变压器' }, { display: '恒压变压器' }, { display: '可调电源变压器' },
                { display: '控制变压器' }, { display: '矿用变压器' }, { display: '脉冲变压器' },
                { display: '普通变压器' }, { display: '试验变压器' }, { display: '稳压变压器' },
                { display: '音频变压器' }, { display: '照明变压器' }
            ]},
            { display: '不间断电源/应急电源', children: [
                { display: '不间断供电电源（UPS）' }, { display: '单相应急电源' },
                { display: '高频不间断电源' }, { display: '工频不间断电源' }, { display: '三相应急电源' }
            ]},
            { display: '电工电器成套设备' },
            { display: '电力电容器及配套设备', children: [
                { display: '电力电容器' }
            ]},
            { display: '电力电子元器件', children: [
                { display: '电力连接器' }, { display: '低频连接器电缆组件' },
                { display: '接线盒' }, { display: '接线柱' }
            ]},
            { display: '电气信号设备装置', children: [
                { display: '交通灯' }, { display: '闪烁信号灯/间歇信号灯' },
                { display: '信号发生器（电气装置）' }
            ]},
            { display: '电线电缆', children: [
                { display: '光缆' }, { display: '光纤' }, { display: '特种电缆' }, { display: '通用电缆' }
            ]},
            { display: '低压电路保护控制装置', children: [
                { display: '变送器' }, { display: '电抗器' }, { display: '电涌保护器' },
                { display: '调速器' }, { display: '定时器/时控开关' }, { display: '低压断路器' },
                { display: '低压接触器' }, { display: '低压开关柜' }, { display: '低压控制器' },
                { display: '低压熔断器' }, { display: '断路器辅助' }, { display: '防爆电气' },
                { display: '分流器' }, { display: '功率补偿器件' }, { display: '计数器' },
                { display: '起动器' }, { display: '数字温控器' }, { display: '脱扣器' },
                { display: '主令电器' }
            ]},
            { display: '低压电气' },
            { display: '高压开关与保护电器装置', children: [
                { display: '避雷器' }, { display: '高压负荷开关' }, { display: '高压隔离开关' },
                { display: '高压接触器' }, { display: '高压接地开关' }, { display: '高压开关柜' },
                { display: '高压熔断器' }, { display: '柱上开关' }
            ]},
            { display: '工控系统及装备', children: [
                { display: '保护器' }, { display: 'PLC' }, { display: '人机界面' },
                { display: '伺服定位系统' }, { display: '振动盘' }
            ]},
            { display: '工业电源', children: [
                { display: '开关电源' }, { display: '直流稳压电源' }
            ]},
            { display: '光伏设备及元器件' }, { display: '互感器' },
            { display: '继电器' }, { display: '节电器' }, { display: '机器人' },
            { display: '绝缘制品' }, { display: 'LED设备' }, { display: '配电开关控制设备' },
            { display: '配电输电设备' }, { display: '输配电及控制设备辅件' },
            { display: '太阳能电池', children: [
                { display: '太阳能电池（光伏电池）' }, { display: '太阳能控制设备' }
            ]},
            { display: '稳压器', children: [
                { display: '补偿式电力稳压器' }, { display: '单/三相全自动稳压器' },
                { display: '通用型稳压器' }, { display: '专用型稳压器' }
            ]},
            { display: '线材', children: [ { display: '扎丝' } ]},
            { display: '蓄电池', children: [
                { display: '超级电容单体/模块/系统' }, { display: '超级电容管理系统' },
                { display: '电池管理系统' }, { display: '电源处理模块' }, { display: '固定型' },
                { display: '铅蓄电池' }, { display: '起动型' }, { display: '燃料电池' },
                { display: '蓄电池' }, { display: '蓄电池充电器' }
            ]}
        ]},
        { display: '阀门', children: [
            { display: '调压阀' }, { display: '蝶阀' }, { display: '底阀' },
            { display: '浮球阀' }, { display: '减压阀' }, { display: '截止阀' },
            { display: '其他阀门' }, { display: '球阀' }, { display: '旋塞阀' },
            { display: '闸阀' }, { display: '止回阀' }
        ]},
        { display: '钢材', children: [
            { display: '扁钢' }, { display: '槽钢' }, { display: '钢板' },
            { display: '角钢' }, { display: '螺纹钢' }, { display: '模具钢/工具钢/特钢' }, { display: '圆钢' }
        ]},
        { display: '工位器具', children: [
            { display: '工具包' }, { display: '工具车/手推车/平板车' }, { display: '工具柜' },
            { display: '零件盒' }, { display: '五金工具箱' }
        ]},
        { display: '焊接设备及耗材', children: [
            { display: '储能机' }, { display: '等离子焊机' }, { display: '等离子切割机' },
            { display: '点焊机' }, { display: '电焊机' }, { display: '电焊钳' },
            { display: '电焊条' }, { display: '电火花' }, { display: '电阻焊机' },
            { display: '割炬' }, { display: '滚焊机' }, { display: '焊管机' },
            { display: '焊接配件' }, { display: '焊炬/枪' }, { display: '焊线机' },
            { display: '焊锡机' }, { display: '回流焊接机' }, { display: '激光焊机' },
            { display: '激光切割机' }, { display: '摩擦焊机' }, { display: '排焊机' },
            { display: '碰焊机' }, { display: '钎料' }, { display: '其他电焊/切割设备' },
            { display: '热熔器' }, { display: '塑焊机' }, { display: '线切割' }, { display: '压焊机' }
        ]},
        { display: '机电五金', children: [
            { display: '泵', children: [
                { display: '充气泵' }, { display: '电泵' }, { display: '空压机' },
                { display: '离心泵' }, { display: '其它类型泵' }, { display: '试压泵' },
                { display: '水泵' }, { display: '污水泵' }, { display: '油泵' },
                { display: '增压泵' }, { display: '真空泵' }
            ]},
            { display: '泵配件' },
            { display: '变速机', children: [
                { display: '齿轮变速机' }, { display: '减速机配件' }, { display: '涡轮蜗杆减速机' },
                { display: '行星摆线针轮减速机' }, { display: '行星齿轮减速机' }
            ]},
            { display: '电池/电力配件' },
            { display: '电动机' }, { display: '电机配件' },
            { display: '电热设备', children: [
                { display: '伴热设备' }, { display: '电热带' }, { display: '电热管' },
                { display: '电热膜' }, { display: '电热圈/片/盘/板' }, { display: '电热丝' },
                { display: '发热芯' }, { display: '孵化器' }, { display: '工业电炉' },
                { display: '工业烤箱' }, { display: '硅碳棒' }, { display: '其他电热设备' },
                { display: '热电偶' }, { display: '热电阻' }, { display: '实验电炉' },
                { display: '驻车加热器' }
            ]},
            { display: '电梯配件' },
            { display: '发电机', children: [
                { display: '柴油发电机' }, { display: '发电机组零部件' }, { display: '风力发电机' },
                { display: '其他发电机' }, { display: '汽油发电机' }, { display: '燃煤发电机' },
                { display: '燃气发电机' }, { display: '水力发电机' }, { display: '太阳能发电机' }
            ]},
            { display: '风机' },
            { display: '内燃机', children: [
                { display: '柴油机' }, { display: '其他内燃机' }, { display: '汽油机' }
            ]},
            { display: '其他机电五金' }, { display: '汽油镐' },
            { display: '压力管道' }, { display: '压力容器' }, { display: '油锯' }
        ]},
        { display: '紧固件', children: [
            { display: '挡圈' }, { display: '垫圈' }, { display: '钉' },
            { display: '钢丝绳卡头' },
            { display: '螺钉', children: [
                { display: '机螺钉' }, { display: '其他螺钉' }, { display: '自攻螺钉' }
            ]},
            { display: '螺母' }, { display: '螺栓' }, { display: '螺套' }, { display: '螺柱' },
            { display: '铆钉', children: [
                { display: '半空心铆钉' }, { display: '抽芯铆钉' }, { display: '单面铆钉' },
                { display: '封闭型抽芯铆钉' }, { display: '击芯铆钉' }, { display: '空心铆钉' },
                { display: '拉铆螺母' }, { display: '拉铆螺栓' }, { display: '其他铆钉' },
                { display: '实心铆钉' }, { display: '双鼓形铆钉' }, { display: '无头铆钉' }
            ]},
            { display: '排钉' },
            { display: '膨胀类', children: [
                { display: '化学锚栓' }, { display: '金属膨胀螺栓' }, { display: '金属膨胀管' },
                { display: '尼龙膨胀管' }, { display: '其他膨胀类' }, { display: '塑料膨胀管' },
                { display: '自切底锚栓' }
            ]},
            { display: '其它紧固件' },
            { display: '销', children: [
                { display: '弹性圆柱销' }, { display: '开口销' }, { display: '其他销' }, { display: '圆锥销' }
            ]},
            { display: '组合件和连接副' }
        ]},
        { display: '金属粉末', children: [
            { display: '金属粉末' }
        ]},
        { display: '机械五金', children: [
            { display: '剥线机' }, { display: '铲车/装载机' }, { display: '车床' },
            { display: '冲床' }, { display: '弹簧' }, { display: '淀粉机' },
            { display: '吊钩/抓钩' }, { display: '吊滑车' }, { display: '调直机' },
            { display: '法兰' }, { display: '封边机' }, { display: '分离设备' },
            { display: '粉碎机/玉米粉碎机' }, { display: '攻丝机' }, { display: '工作台' },
            { display: '管夹' }, { display: '管接头' }, { display: '滚筒' },
            { display: '化工管道及配件' }, { display: '滑块' }, { display: '滑轮' },
            { display: '节能罩' }, { display: '机械喷嘴' }, { display: '卡爪' },
            { display: '炉头' }, { display: '密封件' }, { display: '抹光机' },
            { display: '碾米机' }, { display: '抛光轮' }, { display: '喷砂机' },
            { display: '其他机械五金' }, { display: '去皮机' }, { display: '润滑油/脂' },
            { display: '上料机' }, { display: '饲料搅拌机' }, { display: '饲料颗粒机' },
            { display: '托辊' }, { display: '挖掘机' }, { display: '弯箍机' },
            { display: '微耕机' }, { display: '吸粮机' }, { display: '玉米脱粒机' },
            { display: '铡草机' }, { display: '振平尺' }
        ]},
        { display: '劳保用品', children: [
            { display: '防护服', children: [
                { display: '防化服' }, { display: '防静电服' }, { display: '防水服' },
                { display: '焊接防护服' }, { display: '其他防护服' }, { display: '阻燃服' }
            ]},
            { display: '护栏/隔离栏/围栏/铁丝网', children: [
                { display: '护栏/隔离栏/围栏' }, { display: '铁丝网' }
            ]},
            { display: '呼吸防护', children: [
                { display: '防毒面具' }, { display: '防尘口罩' }, { display: '过滤元件' },
                { display: '空气呼吸器' }, { display: '其他呼吸防护' }, { display: '自救呼吸器' }
            ]},
            { display: '交通安全保护', children: [
                { display: '安全锥/路锥' }, { display: '车轮挡' }, { display: '防撞桶' },
                { display: '防撞墩' }, { display: '防撞护栏' }, { display: '隔离墩' },
                { display: '减速带' }, { display: '警示灯' }, { display: '警示牌' },
                { display: '警示柱' }, { display: '路障' }, { display: '其他交通安全保护' },
                { display: '停车场设施' }, { display: '停车锁' }, { display: '限高架' },
                { display: '限速标志' }, { display: '信号灯' }, { display: '雪糕筒' },
                { display: '引导牌' }, { display: '指示牌' }, { display: '转角镜' },
                { display: '阻车器' }
            ]},
            { display: '绳网', children: [
                { display: '安全绳' }, { display: '安全网' }, { display: '防护网' }, { display: '绳梯' }
            ]},
            { display: '手部防护', children: [
                { display: '防割手套' }, { display: '防化手套' }, { display: '防静电手套' },
                { display: '防热手套' }, { display: '劳保手套' }, { display: '其他手部防护' },
                { display: '焊接手套' }
            ]},
            { display: '头部/耳部防护', children: [
                { display: '安全帽' }, { display: '耳塞/耳罩' }, { display: '防护头盔' }, { display: '其他头部防护' }
            ]},
            { display: '消防器材', children: [
                { display: '灭火器' }, { display: '灭火器箱' }, { display: '灭火毯' },
                { display: '其他消防器材' }, { display: '消防斧' }, { display: '消防泵' },
                { display: '消防车' }, { display: '消防服' }, { display: '消防桶' },
                { display: '消防箱' }, { display: '消防栓' }, { display: '消防水带' }
            ]},
            { display: '眼部/面部防护', children: [
                { display: '防护面罩' }, { display: '防护眼镜' }, { display: '防护眼罩' },
                { display: '焊接面罩' }, { display: '其他眼部/面部防护' }, { display: '遮光眼镜' }
            ]},
            { display: '坠落防护', children: [
                { display: '安全带' }, { display: '安全绳' }, { display: '其他坠落防护' }, { display: '自锁器' }
            ]},
            { display: '足部防护鞋', children: [
                { display: '防砸鞋' }, { display: '防静电鞋' }, { display: '防滑鞋' },
                { display: '绝缘鞋' }, { display: '其他足部防护鞋' }, { display: '雨靴/防水鞋' }
            ]}
        ]},
        { display: '铝型材' },
        { display: '气动工具' },
        { display: '起重工具' },
        { display: '刃具' },
        { display: '手动工具' },
        { display: '液压工具' },
        { display: '仪器仪表' },
        { display: '轴承' }
    ]},
    { display: '住宅家具', children: [
        { display: '成套家具', children: [
            { display: '餐厅成套家具', children: [
                { display: '餐边柜+酒架' }, { display: '餐桌+餐椅' }, { display: '餐桌椅+餐边柜' },
                { display: '餐桌椅+餐边柜+餐车' }, { display: '餐桌椅+餐边柜+酒柜' },
                { display: '餐桌椅+餐车' }, { display: '餐桌椅+餐柜+酒柜+餐车' },
                { display: '餐桌椅+酒架' }, { display: '餐桌椅+酒柜' }, { display: '餐桌椅+酒柜+餐车' }
            ]},
            { display: '功能房成套家具' },
            { display: '客厅成套家具', children: [
                { display: '茶几+电视柜' }, { display: '沙发+茶几' }, { display: '沙发+茶几+电视柜' },
                { display: '沙发+茶几+电视柜+角几' }, { display: '沙发+角几' }
            ]},
            { display: '门厅成套家具', children: [
                { display: '隔断+鞋柜' }, { display: '门厅柜+鞋柜' }, { display: '玄关台+门厅柜+衣帽架' }
            ]},
            { display: '其他成套家具' },
            { display: '书房成套家具', children: [
                { display: '书桌+写字椅' }, { display: '书桌椅+书柜' }, { display: '书桌椅+书柜+休闲沙发' }
            ]},
            { display: '卧室成套家具', children: [
                { display: '床+床头柜' }, { display: '床+床头柜+梳妆台' },
                { display: '床+床头柜+梳妆台+衣柜' }, { display: '床+床头柜+衣柜' },
                { display: '双层床+写字桌' }, { display: '双层床+写字桌+衣柜' },
                { display: '梳妆台+梳妆凳' }
            ]}
        ]},
        { display: '床垫类', children: [
            { display: '3D床垫' }, { display: '弹簧床垫' }, { display: '电动/智能床垫' },
            { display: '定制床垫' }, { display: '复合床垫' }, { display: '海绵床垫' },
            { display: '黄麻床垫' }, { display: '记忆棉床垫' }, { display: '卷包/折叠床垫' },
            { display: '凝胶床垫' }, { display: '其他床垫' }, { display: '乳胶床垫' },
            { display: '水床垫' }, { display: '椰棕床垫' }, { display: '圆床垫' }, { display: '棕榈床垫' }
        ]},
        { display: '床类', children: [
            { display: '拔步床/架子床' }, { display: '板木结合床' }, { display: '板式床' },
            { display: '布艺床' }, { display: '充气床' }, { display: '床架/床板' },
            { display: '床配件', children: [
                { display: '床插' }, { display: '床铰链' }, { display: '床幔' }, { display: '其它床配件' }
            ]},
            { display: '电动智能床' }, { display: '科技布床' }, { display: '罗汉床' },
            { display: '飘窗床' }, { display: '皮艺床' }, { display: '实木床' },
            { display: '藤艺床' }, { display: '铁艺/钢木床' }, { display: '衣柜床' },
            { display: '折叠床/午休床' }
        ]},
        { display: '凳类', children: [
            { display: '矮凳' }, { display: '餐凳' }, { display: '充气凳' },
            { display: '床尾凳' }, { display: '高凳/高脚凳' }, { display: '鼓墩/绣墩/鼓凳' },
            { display: '换鞋凳' }, { display: '脚踏凳' }, { display: '其它凳子' },
            { display: '收纳凳' }, { display: '梳妆凳' }, { display: '条凳' },
            { display: '浴室凳' }, { display: '折叠凳' }
        ]},
        { display: '儿童家具/婴儿家具', children: [
            { display: '儿童餐椅/成长椅' }, { display: '儿童成套家具' }, { display: '儿童床垫' },
            { display: '儿童储物架/收纳架' }, { display: '儿童凳' }, { display: '儿童护栏床' },
            { display: '儿童拼接床' }, { display: '儿童沙发' }, { display: '儿童书架' },
            { display: '儿童书柜' }, { display: '儿童榻榻米床' }, { display: '儿童学习椅' },
            { display: '儿童学习桌' }, { display: '儿童椅' }, { display: '儿童衣柜' },
            { display: '儿童桌' }, { display: '儿童桌椅套装' }, { display: '高低/子母床' },
            { display: '普通儿童床' }, { display: '其他儿童家具' }, { display: '玩具椅/踩脚凳' },
            { display: '婴儿床' }, { display: '坐姿矫正椅' }
        ]},
        { display: '根雕类', children: [
            { display: '根雕茶几' }, { display: '根雕茶桌' }, { display: '根雕凳子' },
            { display: '根雕花架' }, { display: '其他' }
        ]},
        { display: '红木家具', children: [
            { display: '红木博古架/多宝格' }, { display: '红木餐边柜' }, { display: '红木餐桌' },
            { display: '红木茶几/边几' }, { display: '红木茶桌/茶台' }, { display: '红木成套家具' },
            { display: '红木床' }, { display: '红木电视柜' }, { display: '红木花架/花几' },
            { display: '红木酒柜' }, { display: '红木罗汉床/贵妃床' }, { display: '红木屏风' },
            { display: '红木沙发' }, { display: '红木书柜/架' }, { display: '红木梳妆台/桌' },
            { display: '红木书桌' }, { display: '红木条案' }, { display: '红木鞋柜/架' },
            { display: '红木椅凳' }, { display: '红木衣柜' }, { display: '红木衣帽架' }
        ]},
        { display: '户外/庭院/阳台家具', children: [
            { display: '公园椅' },
            { display: '户外床', children: [
                { display: '吊床' }, { display: '躺床' }, { display: '折叠床' }
            ]},
            { display: '户外秋千' }, { display: '木屋凉亭' },
            { display: '伞具配件', children: [
                { display: '伞坐/伞底座' }
            ]},
            { display: '庭院凳' }, { display: '真火壁炉' }, { display: '遮阳伞' },
            { display: '桌', children: [
                { display: '公园桌' }, { display: '沙滩桌' }
            ]},
            { display: '桌椅套件' },
            { display: '坐具', children: [
                { display: '庭院/阳台椅' }
            ]}
        ]},
        { display: '家具辅料', children: [
            { display: '玻璃' },
            { display: '布艺' },
            { display: '海绵' },
            { display: '家具纸' },
            { display: '皮革' },
            { display: '其它家具配件' },
            { display: '亚克力' }
        ]},
        { display: '架类', children: [
            { display: '壁炉架/壁炉柜' },
            { display: 'CD架' },
            { display: '多宝格/博古架' },
            { display: '隔断架' },
            { display: '格架' },
            { display: '画架' },
            { display: '花架/花几/花盆架' },
            { display: '家用雨伞架' },
            { display: '酒架' },
            { display: '面盆架' },
            { display: '其他架类' },
            { display: '书报架' },
            { display: '书架' },
            { display: '鞋架' },
            { display: '衣帽架' },
            { display: '置物架/搁板' },
            { display: '组合衣架' }
        ]},
        { display: '几类', children: [
            { display: '边几' },
            { display: '茶几' },
            { display: '功夫茶几' },
            { display: '角几' },
            { display: '炕几/飘窗几' },
            { display: '套几' }
        ]},
        { display: '镜子类', children: [
            { display: '穿衣镜' },
            { display: '化妆镜' },
            { display: '其他镜子' },
            { display: '衣帽架一体镜' },
            { display: '浴室镜' }
        ]},
        { display: '柜类', children: [
            { display: '餐边柜' },
            { display: '茶水柜' },
            { display: '床头柜' },
            { display: '橱柜' },
            { display: '电视柜' },
            { display: '吊柜/壁柜/地柜' },
            { display: '顶箱柜' },
            { display: '斗柜' },
            { display: '佛柜/佛龛/神台/神龛' },
            { display: '简易衣柜' },
            { display: '角柜' },
            { display: '家政柜' },
            { display: '酒柜' },
            { display: '柜子配件' },
            { display: '连体书桌柜' },
            { display: '门厅/玄关柜' },
            { display: '飘窗柜' },
            { display: '其它柜类' },
            { display: '收纳柜' },
            { display: '书柜', children: [
                { display: '单个书柜' },
                { display: '组合书柜' }
            ]},
            { display: '梯柜' },
            { display: '碗柜' },
            { display: '鞋柜' },
            { display: '阳台柜' },
            { display: '药柜' },
            { display: '衣柜' },
            { display: '展示柜' },
            { display: '遮挡柜' }
        ]},
        { display: '屏风/花窗', children: [
            { display: '插屏' },
            { display: '挂屏' },
            { display: '花窗' },
            { display: '折屏/围屏' },
            { display: '座屏' }
        ]},
        { display: '沙发类', children: [
            { display: '布艺沙发' },
            { display: '充气沙发' },
            { display: '单人沙发' },
            { display: '功能沙发' },
            { display: '贵妃椅/榻' },
            { display: '科技布沙发' },
            { display: '懒人沙发' },
            { display: '皮布沙发' },
            { display: '皮艺沙发' },
            { display: '沙发床' },
            { display: '沙发凳/脚踏' },
            { display: '沙发配件及辅料', children: [
                { display: '保丽龙颗粒' },
                { display: '充气泵及修补工具' },
                { display: '泡钉' },
                { display: '沙发脚' }
            ]},
            { display: '实木沙发' },
            { display: '藤/竹沙发' },
            { display: '铁艺沙发' }
        ]},
        { display: '设计师家具', children: [
            { display: '茶几' },
            { display: '沙发' },
            { display: '椅子' },
            { display: '桌子' }
        ]},
        { display: '箱类', children: [
            { display: '家用保险箱' },
            { display: '其他箱类' },
            { display: '衣箱' },
            { display: '藏箱/扣箱' }
        ]},
        { display: '椅类', children: [
            { display: '按摩椅' },
            { display: '餐椅' },
            { display: '电脑椅' },
            { display: '吊篮/吊椅' },
            { display: '交椅' },
            { display: '其它椅子' },
            { display: '人体工学椅' },
            { display: '沙发椅' },
            { display: '躺椅' },
            { display: '围椅/圈椅' },
            { display: '摇椅' },
            { display: '椅类配件', children: [
                { display: '连接杆' },
                { display: '其它椅子配件' },
                { display: '旋转件' },
                { display: '椅脚' }
            ]},
            { display: '折叠椅' }
        ]},
        { display: '桌子/案/台', children: [
            { display: '吧台' },
            { display: '茶桌/台' },
            { display: '床上电脑桌' },
            { display: '岛台餐桌' },
            { display: '电磁炉餐桌' },
            { display: '电动升降桌' },
            { display: '电脑桌' },
            { display: '功夫茶桌' },
            { display: '供桌' },
            { display: '经桌' },
            { display: '烤火桌' },
            { display: '麻将桌' },
            { display: '普通餐桌' },
            { display: '琴桌' },
            { display: '其他桌子' },
            { display: '棋桌/桌游台' },
            { display: '伸缩餐桌/跳台餐桌' },
            { display: '梳妆台/桌' },
            { display: '书桌' },
            { display: '条案/条几' },
            { display: '玄关台' },
            { display: '折叠桌' },
            { display: '桌腿架' },
            { display: '桌子配件' }
        ]}
    ]},
    { display: '清洗/食品/商业设备', children: [
        { display: '工业制冷设备', children: [
            { display: '工业冷水机' },
            { display: '冷却塔' }
        ]},
        { display: '加油站设备', children: [
            { display: '加油机' },
            { display: '加油枪' },
            { display: '加油站设备' }
        ]},
        { display: '清洗/清理设备', children: [
            { display: '打蜡机' },
            { display: '工业除尘器' },
            { display: '扫雪机' }
        ]},
        { display: '食品加工机械', children: [
            { display: '剥壳机' },
            { display: '千张机' },
            { display: '切骨机' },
            { display: '脱油机' },
            { display: '选果机/分选机' }
        ]}
    ]},
    { display: '灯饰光源照明', children: [
        { display: '成套灯具', children: [
            { display: '成套灯具' }
        ]},
        { display: '灯具配件及其他', children: [
            { display: '灯具配件' },
            { display: '其他灯具灯饰' }
        ]},
        { display: '吊灯', children: [
            { display: '餐厅吊灯' },
            { display: '床头/玄关/吧台/过道吊灯' },
            { display: '吊扇灯/风扇灯' },
            { display: '儿童房吊灯' },
            { display: '客厅吊灯' },
            { display: 'LOFT/复式住宅/楼梯吊灯' },
            { display: '麻将房吊灯' },
            { display: '卧室/书房吊灯' }
        ]},
        { display: '功能性灯具', children: [
            { display: '灭蚊灯' },
            { display: '杀菌灯具' }
        ]},
        { display: '工业防爆灯具', children: [
            { display: '防爆道路照明灯' },
            { display: '防爆工矿灯/天棚灯' },
            { display: '防爆功能性灯具' },
            { display: '防爆投光灯/泛光灯' }
        ]},
        { display: '工业户外照明', children: [
            { display: '工业投光灯/泛光灯' }
        ]},
        { display: '工业商业农业照明配件', children: [
            { display: '工业商业农业照明配件' }
        ]},
        { display: '工业室内照明', children: [
            { display: '工业平台灯/支架灯' },
            { display: 'LED工业球泡' },
            { display: '消防应急灯' }
        ]},
        { display: '光源', children: [
            { display: '白炽灯' },
            { display: 'LED灯板' },
            { display: 'LED灯杯' },
            { display: 'LED灯带' },
            { display: 'LED灯管' },
            { display: 'LED飞碟灯' },
            { display: 'LED球泡灯' },
            { display: 'LED玉米灯' },
            { display: '卤钨灯' },
            { display: '其他光源' },
            { display: '荧光灯', children: [
                { display: '紧凑型节能荧光灯' },
                { display: '直管荧光灯' }
            ]}
        ]},
        { display: '户外灯具灯饰', children: [
            { display: '草坪灯' },
            { display: '充电灯泡/地摊灯' },
            { display: '道路灯具', children: [
                { display: '其他道路灯具' },
                { display: '太阳能路灯' }
            ]},
            { display: '地脚灯/地埋灯' },
            { display: '端景台灯饰' },
            { display: '工矿灯具' },
            { display: '户外壁灯' },
            { display: '户外吊灯' },
            { display: '其他庭院灯饰' },
            { display: '水下灯' },
            { display: '太阳能庭院灯饰', children: [
                { display: '其他太阳能庭院灯饰' },
                { display: '太阳能草坪灯' },
                { display: '太阳能投光灯' }
            ]},
            { display: '投光灯/泛光灯' },
            { display: '洗墙灯' },
            { display: '应急灯' },
            { display: '柱头灯' }
        ]},
        { display: '家居类灯饰', children: [
            { display: '壁灯' },
            { display: '橱柜灯' },
            { display: '氛围灯' },
            { display: '感应灯' },
            { display: '镜前灯/化妆补妆灯' },
            { display: '落地灯' },
            { display: '奇光板/量子灯' },
            { display: '小夜灯' },
            { display: '支架灯' }
        ]},
        { display: '教育照明', children: [
            { display: '教室吊灯' },
            { display: '教室吸顶灯' }
        ]},
        { display: '农业照明', children: [
            { display: '农贸白光灯' },
            { display: '其他农业照明' },
            { display: '植物生长灯' }
        ]},
        { display: '商业照明', children: [
            { display: '办公/商场超市/健身房吊灯' },
            { display: '酒店/宴会厅/餐饮吊灯' },
            { display: '商业灯带' },
            { display: '商业轨道灯' },
            { display: '商业平板灯' },
            { display: '商业射灯' },
            { display: '商业筒灯' },
            { display: '商用吸顶灯' }
        ]},
        { display: '台灯', children: [
            { display: '钢琴灯' },
            { display: '护眼台灯/学习灯' },
            { display: '屏幕灯/屏幕挂灯' },
            { display: '装饰台灯' }
        ]},
        { display: '特种光源', children: [
            { display: '红外线灯泡' },
            { display: '紫外线灯管' }
        ]},
        { display: '无主灯类灯饰', children: [
            { display: '磁吸轨道灯' },
            { display: '斗胆灯' },
            { display: '格栅/面板灯/平板灯' },
            { display: '聚光灯' },
            { display: '射灯' },
            { display: '筒灯' },
            { display: '线性灯' },
            { display: '星空顶' }
        ]},
        { display: '吸顶灯', children: [
            { display: '餐厅吸顶灯' },
            { display: '厨卫/阳台/玄关/过道吸顶灯' },
            { display: '儿童房吸顶灯' },
            { display: '客厅吸顶灯' },
            { display: '书房吸顶灯' },
            { display: '卧室吸顶灯' }
        ]}
    ]}
];
