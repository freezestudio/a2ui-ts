/**
 * A2UI Eval 评测 Prompt 集合
 * 从 A2UI 规范评测系统中选取的 12 个代表性 prompt
 */

import type { TestPrompt } from './types.js';

export const prompts: TestPrompt[] = [
  {
    name: 'loginForm',
    description: '登录表单 — 包含用户名、密码输入和提交按钮',
    promptText: `生成一个登录页面的 A2UI JSON。
1. 创建 surface（ID: "login-page"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["title", "usernameField", "passwordField", "rememberRow", "buttonRow"]
   - title: Text, variant="body", text="用户登录"
   - usernameField: TextField, label="用户名", placeholder="请输入用户名"
   - passwordField: TextField, label="密码", placeholder="请输入密码", variant="obscured"
   - rememberRow: Row, children: ["rememberCheck"]
   - rememberCheck: CheckBox, label="记住我", value=true
   - buttonRow: Row, children: ["loginBtn", "registerBtn"]
   - loginBtn: Button, child 引用 loginBtnLabel, action 的 event name="login"
   - loginBtnLabel: Text, text="登录", variant="body"
   - registerBtn: Button, child 引用 registerBtnLabel, action 的 event name="register"
   - registerBtnLabel: Text, text="注册", variant="body"

核心要求 message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'productGallery',
    description: '商品展示 — 图片列表与详情卡片',
    promptText: `生成一个商品展示页面的 A2UI JSON。
1. 创建 surface（ID: "gallery"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["card1", "card2", "card3"]
   - card1: Card, child="card1-content"
   - card1-content: Column, children: ["card1-img", "card1-name", "card1-price", "card1-btn"]
   - card1-img: Image, url="https://via.placeholder.com/150", description="无线耳机"
   - card1-name: Text, text="无线耳机", variant="body"
   - card1-price: Text, text="¥299", variant="body"
   - card1-btn: Button, child="card1-btn-text", action event name="buy-1"
   - card1-btn-text: Text, text="加入购物车"
   - card2: Card, child="card2-content"
   - card2-content: Column, children: ["card2-img", "card2-name", "card2-price", "card2-btn"]
   - card2-img: Image, url="https://via.placeholder.com/150", description="蓝牙音箱"
   - card2-name: Text, text="蓝牙音箱", variant="body"
   - card2-price: Text, text="¥599", variant="body"
   - card2-btn: Button, child="card2-btn-text", action event name="buy-2"
   - card2-btn-text: Text, text="加入购物车"
   - card3: Card, child="card3-content"
   - card3-content: Column, children: ["card3-img", "card3-name", "card3-price", "card3-btn"]
   - card3-img: Image, url="https://via.placeholder.com/150", description="智能手表"
   - card3-name: Text, text="智能手表", variant="body"
   - card3-price: Text, text="¥1299", variant="body"
   - card3-btn: Button, child="card3-btn-text", action event name="buy-3"
   - card3-btn-text: Text, text="加入购物车"

核心要求 message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'settingsPage',
    description: '设置页面 — 多种表单控件组合',
    promptText: `生成一个应用设置页面的 A2UI JSON。
1. 创建 surface（ID: "settings"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["notifGroup", "langGroup", "fontGroup", "cacheGroup"]
   - notifGroup: Card, child="notifContent"
   - notifContent: Column, children: ["notifLabel", "notifToggle"]
   - notifLabel: Text, text="通知", variant="body"
   - notifToggle: CheckBox, label="启用通知", value=true
   - langGroup: Card, child="langContent"
   - langContent: Column, children: ["langLabel", "langPicker"]
   - langLabel: Text, text="语言", variant="body"
   - langPicker: ChoicePicker, label="选择语言", options=[{label:"中文",value:"zh"},{label:"English",value:"en"},{label:"日本語",value:"ja"}], value=["zh"]
   - fontGroup: Card, child="fontContent"
   - fontContent: Column, children: ["fontLabel", "fontSlider"]
   - fontLabel: Text, text="字体大小", variant="body"
   - fontSlider: Slider, label="字体大小", value=16, min=12, max=24
   - cacheGroup: Card, child="cacheContent"
   - cacheContent: Column, children: ["cacheLabel", "cacheBtn"]
   - cacheLabel: Text, text="缓存", variant="body"
   - cacheBtn: Button, child="cacheBtnText", action event name="clear-cache"
   - cacheBtnText: Text, text="清除缓存"
   - 各组间用 Divider: component="Divider", axis="horizontal"（注意：axis 是组件属性，不要放在 children 中）

核心要求：
- 除 Column/Row/List/Card 的 children/child 字段外，禁止在其他字段使用 children
- message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'contactForm',
    description: '联系表单 — 多字段表单与校验',
    promptText: `生成一个联系我们表单的 A2UI JSON。
1. 创建 surface（ID: "contact"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["nameField", "emailField", "subjectPicker", "messageField", "submitBtn"]
   - nameField: TextField, label="姓名", placeholder="请输入姓名"
   - emailField: TextField, label="邮箱", placeholder="请输入邮箱", variant="shortText"
   - subjectPicker: ChoicePicker, label="主题", options=[{label:"咨询",value:"inquiry"},{label:"反馈",value:"feedback"},{label:"合作",value:"cooperation"},{label:"其他",value:"other"}], value=["inquiry"]
   - messageField: TextField, label="留言", placeholder="请输入留言内容", variant="longText"
   - submitRow: Row, children: ["submitBtn", "submitBtnText"]
   - submitBtn: Button, child="submitBtnText", action event name="submit"
   - submitBtnText: Text, text="提交"
   - emailField 的 checks 设为 [{condition:{call:"regex",args:{value:{$path:"/email"}...}}]

核心要求 message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'dashboard',
    description: '数据仪表板 — 多区域数据展示',
    promptText: `生成一个数据仪表板页面的 A2UI JSON。
1. 创建 surface（ID: "dashboard-main"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["contentRow", "footerDivider", "updateTime"]
   - contentRow: Row, children: ["leftPanel", "rightPanel"]
   - leftPanel: Card, child="leftContent"
   - leftContent: Column, children: ["overviewTitle", "userStat", "orderStat", "revenueStat"]
   - overviewTitle: Text, text="今日概览", variant="body"
   - userStat: Text, text="用户数: 1,234", variant="body"
   - orderStat: Text, text="订单数: 567", variant="body"
   - revenueStat: Text, text="收入: ¥89,012", variant="body"
   - rightPanel: Card, child="rightContent"
   - rightContent: Column, children: ["activityTitle", "act1", "act2", "act3"]
   - activityTitle: Text, text="最近活动", variant="body"
   - act1: Text, text="用户A完成下单", variant="body"
   - act2: Text, text="用户B修改地址", variant="body"
   - act3: Text, text="用户C提交退款", variant="body"
   - footerDivider: Divider, axis="horizontal"
   - updateTime: Text, text="更新时间: 2024-01-15 14:30", variant="caption"

核心要求 message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'musicPlayer',
    description: '音乐播放器 — 控件组合与状态展示',
    promptText: `生成一个音乐播放器界面的 A2UI JSON。
1. 创建 surface（ID: "player"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["playerCard"]
   - playerCard: Card, child="playerContent"
   - playerContent: Column, children: ["songInfo", "progressSlider", "controlRow", "volumeRow"]
   - songInfo: Column, children: ["songTitle", "artistName"]
   - songTitle: Text, text="夜曲", variant="body"
   - artistName: Text, text="周杰伦", variant="body"
   - progressSlider: Slider, label="进度", value=95, min=0, max=240
   - controlRow: Row, children: ["prevBtn", "playBtn", "nextBtn"]
   - prevBtn: Button, child="prevText", action event name="prev"
   - prevText: Text, text="上一首"
   - playBtn: Button, child="playText", action event name="play-pause"
   - playText: Text, text="播放/暂停"
   - nextBtn: Button, child="nextText", action event name="next"
   - nextText: Text, text="下一首"
   - volumeRow: Row, children: ["volumeLabel", "volumeSlider"]
   - volumeLabel: Text, text="音量", variant="body"
   - volumeSlider: Slider, label="音量", value=70, min=0, max=100

核心要求 message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'weatherForecast',
    description: '天气预报 — 动态数据绑定',
    promptText: `生成一个天气预报页面的 A2UI JSON。
1. 创建 surface（ID: "weather"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["cityRow", "currentWeather", "divider", "forecastList"]
   - cityRow: Row, children: ["cityIcon", "cityName"]
   - cityIcon: Icon, name="locationOn"（name 是属性，禁止放 children 里）
   - cityName: Text, text="杭州", variant="body"
   - currentWeather: Row, children: ["tempText", "conditionText"]
   - tempText: Text, text="26°C", variant="body"
   - conditionText: Text, text="多云", variant="body"
   - divider: Divider, axis="horizontal"
   - forecastList: Column, children: ["day1", "day2", "day3"]
   - day1: Row, children: ["day1Date", "day1Weather", "day1Temp"]
   - day1Date: Text, text="周一", variant="body"
   - day1Weather: Text, text="晴", variant="body"
   - day1Temp: Text, text="28°C", variant="body"
   - day2: Row, children: ["day2Date", "day2Weather", "day2Temp"]
   - day2Date: Text, text="周二", variant="body"
   - day2Weather: Text, text="小雨", variant="body"
   - day2Temp: Text, text="25°C", variant="body"
   - day3: Row, children: ["day3Date", "day3Weather", "day3Temp"]
   - day3Date: Text, text="周三", variant="body"
   - day3Weather: Text, text="阴", variant="body"
   - day3Temp: Text, text="22°C", variant="body"

核心要求 message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'flightBooker',
    description: '航班预订 — 复杂表单交互',
    promptText: `生成一个航班预订表单的 A2UI JSON。
1. 创建 surface（ID: "flight-search"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["fromGroup", "toGroup", "dateGroup", "passengerGroup", "cabinGroup", "searchBtn"]
   - fromGroup: Card, child="fromContent"
   - fromContent: Column, children: ["fromLabel", "fromField"]
   - fromLabel: Text, text="出发城市", variant="body"
   - fromField: TextField, label="出发城市", placeholder="请输入出发城市"
   - toGroup: Card, child="toContent"
   - toContent: Column, children: ["toLabel", "toField"]
   - toLabel: Text, text="到达城市", variant="body"
   - toField: TextField, label="到达城市", placeholder="请输入到达城市"
   - dateGroup: Card, child="dateContent"
   - dateContent: Column, children: ["departDate", "returnDate"]
   - departDate: DateTimeInput, label="出发日期", value="2024-03-15", enableDate=true
   - returnDate: DateTimeInput, label="返回日期", value="2024-03-20", enableDate=true
   - passengerGroup: Card, child="passengerContent"
   - passengerContent: Column, children: ["passengerLabel", "passengerPicker"]
   - passengerLabel: Text, text="乘客人数", variant="body"
   - passengerPicker: ChoicePicker, label="乘客人数", options=[{label:"1人",value:"1"},{label:"2人",value:"2"},{label:"3人",value:"3"},{label:"4人",value:"4"}], value=["1"]
   - cabinGroup: Card, child="cabinContent"
   - cabinContent: Column, children: ["cabinLabel", "cabinPicker"]
   - cabinLabel: Text, text="舱位", variant="body"
   - cabinPicker: ChoicePicker, label="舱位", options=[{label:"经济舱",value:"economy"},{label:"商务舱",value:"business"},{label:"头等舱",value:"first"}], value=["economy"]
   - searchBtn: Button, child="searchText", action event name="search-flights"
   - searchText: Text, text="搜索航班"

核心要求 message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'surveyForm',
    description: '调查问卷 — 多类型问题组合',
    promptText: `生成一个用户满意度调查问卷的 A2UI JSON。
1. 创建 surface（ID: "survey"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["header", "ratingGroup", "singleChoice", "multiChoice", "openField", "submitRow"]
   - header: Text, text="感谢您的参与！", variant="body"
   - ratingGroup: Card, child="ratingContent"
   - ratingContent: Column, children: ["ratingLabel", "ratingSlider"]
   - ratingLabel: Text, text="整体满意度", variant="body"
   - ratingSlider: Slider, label="评分", value=8, min=1, max=10
   - singleChoice: Card, child="singleContent"
   - singleContent: Column, children: ["singleLabel", "singlePicker"]
   - singleLabel: Text, text="您最常用的功能？", variant="body"
   - singlePicker: ChoicePicker, label="常用功能", options=[{label:"搜索",value:"search"},{label:"推荐",value:"recommend"},{label:"客服",value:"service"},{label:"设置",value:"settings"}], value=["search"]
   - multiChoice: Card, child="multiContent"
   - multiContent: Column, children: ["multiLabel", "designCheck", "speedCheck", "featureCheck", "stableCheck"]
   - multiLabel: Text, text="您希望改进哪些方面？", variant="body"
   - designCheck: CheckBox, label="界面设计", value=false
   - speedCheck: CheckBox, label="响应速度", value=false
   - featureCheck: CheckBox, label="功能丰富度", value=false
   - stableCheck: CheckBox, label="稳定性", value=false
   - openField: Card, child="openContent"
   - openContent: Column, children: ["openLabel", "openInput"]
   - openLabel: Text, text="其他建议", variant="body"
   - openInput: TextField, label="建议内容", variant="longText", placeholder="请输入您的建议..."
   - submitRow: Row, children: ["submitBtn", "submitText"]
   - submitBtn: Button, child="submitText", action event name="submit-survey"
   - submitText: Text, text="提交"

核心要求 message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'nestedDataBinding',
    description: '嵌套数据绑定 — 数据模型驱动 UI',
    promptText: `生成一个订单详情页面的 A2UI JSON，使用 dataModel 绑定数据。
1. 创建 surface（ID: "order-detail"），dataModel 设为：
   { orderId: "ORD-2024-001", status: "已发货", receiver: { name: "张三", address: "杭州市西湖区xxx路", phone: "138xxxx" }, items: [{ name: "商品A", quantity: 2, price: 100 }, { name: "商品B", quantity: 1, price: 200 }], total: 400 }
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["orderHeader", "receiverInfo", "itemsTitle", "itemsList", "totalRow"]
   - orderHeader: Row, children: ["orderIdText", "statusText"]
   - orderIdText: Text, text={ path: "/orderId" }
   - statusText: Text, text={ path: "/status" }
   - receiverInfo: Card, child="receiverContent"
   - receiverContent: Column, children: ["nameText", "addressText", "phoneText"]
   - nameText: Text, text={ path: "/receiver/name" }
   - addressText: Text, text={ path: "/receiver/address" }
   - phoneText: Text, text={ path: "/receiver/phone" }
   - itemsTitle: Text, text="商品列表", variant="body"
   - itemsList: List, direction="vertical", children={ componentId: "itemTemplate", path: "/items" }
   - itemTemplate: Row, children: ["itemName", "itemQty", "itemPrice"]
   - itemName: Text, text={ path: "/name" }
   - itemQty: Text, text={ path: "/quantity" }
   - itemPrice: Text, text={ path: "/price" }
   - totalRow: Row, children: ["totalLabel", "totalValue"]
   - totalLabel: Text, text="总计:", variant="body"
   - totalValue: Text, text={ path: "/total" }

核心要求：
- 所有数据绑定路径必须以 / 开头（绝对 JSON Pointer）
- message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'deleteSurface',
    description: '删除表面 — Surface 生命周期',
    promptText: `生成一个展示 Surface 生命周期的 A2UI JSON。
1. 创建 surface（ID: "temp-surface"）
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["welcomeText", "closeBtn"]
   - welcomeText: Text, text="临时页面"
   - closeBtn: Button, child="closeBtnText", action event name="close"
   - closeBtnText: Text, text="关闭"
3. 在同一个 JSON 数组中添加 deleteSurface 消息删除 surface（surfaceId: "temp-surface"）

核心要求 message array 必须包含 3 条消息：[createSurface, updateComponents, deleteSurface]`,
  },
  {
    name: 'updateDataModel',
    description: '更新数据模型 — 动态数据更新',
    promptText: `创建一个计数器页面：
1. 先创建 surface（ID: "counter"）
2. 更新组件：Column 根组件包含一个 Text 显示计数值（绑定数据模型 /count），
   一个"增加"Button（action 更新数据模型 /count 加 1），一个"重置"Button（action 设置 /count 为 0）
3. 初始化数据模型 /count 为 0`,
  },
  {
    name: 'callRendererFunction',
    description: '服务端调用渲染端函数 — callRendererFunction 消息',
    promptText: `生成一个包含 callRendererFunction 消息的 A2UI JSON。
1. 创建 surface（ID: "notifications"）
2. 使用 updateComponents 创建组件：Column 根组件包含两个子组件 titleEl（Text, text="新消息通知"）和 sendBtn（Button, child 引用 buttonLabel 组件，buttonLabel 为 Text, text="发送测试通知"）
3. 最后在同一个 JSON 数组中添加一条 callRendererFunction 消息：callRendererFunction.functionCallId="call-001", callRendererFunction.callFunction.call="getScreenResolution", callRendererFunction.callFunction.catalogId="https://example.com/a2ui/v1.0/device-catalog.json", callRendererFunction.callFunction.args.screenIndex=0

核心要求 message array 必须包含 3 条消息：[createSurface, updateComponents, callRendererFunction]`,
  },
  {
    name: 'openUrlAction',
    description: '用户激活函数 — Button action.functionCall 触发 openUrl',
    promptText: `生成一个包含用户激活函数（openUrl）的 A2UI JSON。
1. 创建 surface（ID: "notifications"）
2. 使用 updateComponents 创建组件：Column 根组件包含两个子组件 titleEl（Text, text="新消息通知"）和 sendBtn（Button, child 引用 buttonLabel 组件，buttonLabel 为 Text, text="打开示例链接"）
3. sendBtn 的 action 使用 functionCall 形式：action.functionCall.call="openUrl", action.functionCall.args.url="https://example.com/notification"

注意：openUrl 声明 requiresUserActivation，只能通过组件 action.functionCall 由用户交互触发，禁止用 callRendererFunction 消息直接调用。

核心要求 message array 必须包含 2 条消息：[createSurface, updateComponents]`,
  },
  {
    name: 'agentFunctionResponse',
    description: 'Agent 函数响应 — agentFunctionResponse 消息',
    promptText: `生成一个包含 agentFunctionResponse 消息的 A2UI JSON。
1. 创建 surface（ID: "form-submit"）
2. 使用 updateComponents 创建组件：Column 根组件包含两个子组件 successText（Text, text="提交成功"）和 feedbackText（Text, text="感谢您的反馈"）
3. 在同一个 JSON 数组中添加一条 agentFunctionResponse 消息：agentFunctionResponse.functionCallId="call-agent-001", agentFunctionResponse.value={ status: "ok", message: "表单已提交" }

核心要求 message array 必须包含 3 条消息：[createSurface, updateComponents, agentFunctionResponse]`,
  },
  {
    name: 'dynamicListTemplate',
    description: '动态列表模板 — ChildList + 数据绑定',
    promptText: `生成一个使用 ChildList 模板语法的 A2UI JSON。
1. 创建 surface（ID: "product-list"），dataModel 设为 { products: [{ name: "商品A", price: 100 }, { name: "商品B", price: 200 }, { name: "商品C", price: 300 }] }
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["title", "productList"]
   - title: Text, text="商品列表"
   - productList: List, children={ componentId: "product-item", path: "/products" }
   - product-item: Row, children: ["nameText", "priceText"]
   - nameText: Text, text={ path: "name" }（模板项内的相对路径，解析为 /products/N/name）
   - priceText: Text, text={ path: "price" }（解析为 /products/N/price）

核心要求：模板项内使用相对路径；模板外使用以 / 开头的绝对 JSON Pointer`,
  },
  {
    name: 'errorSurface',
    description: '错误场景 — 包含 error 和异常处理',
    promptText: `生成一个错误展示页面。
1. 创建 surface（ID: "error-demo"），dataModel 设为 { errorCode: "NOT_FOUND", errorMessage: "请求的资源不存在" }
2. 使用 updateComponents 创建组件：
   - root: Column, children: ["title", "detail", "retryBtn"]
   - title: Text, text="出错了"（h2 变体）
   - detail: Text, text={ path: "/errorMessage" }（绑定数据模型）
   - retryBtn: Button, child 引用 retryBtnLabel, action 设为 event name="retry"
   - retryBtnLabel: Text, text="重试"
   - Button 的 action 使用 event 格式：{ "event": { "name": "retry" } }

核心要求：Button 组件必须通过 child 引用 Text 组件，不能把文字直接放 children 里`,
  },
];
