# Atoshi Staking DApp

Atoshi 链的质押 DApp，以 WebView 形式嵌入 Atoshi 钱包。

覆盖质押 / 追加质押 / 解除质押 / 转委托 / 领取奖励全流程，以及验证人列表与详情。

---

## 三处与常规 Cosmos 链不同的地方

这三条决定了界面上必须讲清楚什么，改代码前先看懂：

**1. 质押 ATOS，奖励是 ATOX，不是 ATOS。**

这条链是双币设计。ATOS 是 gas 币和质押币；ATOX 是每个区块产出的挖矿奖励币，按质押比例分给验证人和委托人。所以「待领奖励」那一栏的单位是 **ATOX**。

链上 `inflation` 是关闭的，不铸 ATOS。因此年化收益不能用「通胀率 ÷ 质押率」那套公式算 —— 那会算出 0。这里按 ATOX 的发行速率算：

```
年化(ATOX) = 每年 ATOX 产出 × (1 - 佣金率) / 全网总质押
```

推导见 `src/services/stakingApiChain.ts` 里 `estimateAprAtox` 的注释。一个反直觉的结论：委托人的 ATOX 年化只取决于佣金率和全网总质押，跟选哪个验证人无关。

**2. ATOX 自动兑换成 ATOS，用户不需要做任何操作。**

Tier 释放条件达成时，链上会把一批 ATOS 注入「ATOX↔ATOS 兑换池」，用户持有的 ATOX 按比例自动结算成 ATOS 打进余额。**没有「手动兑换」这个动作**，界面上不要出现这样的按钮。

**3. 质押不会减少能量额度。**

这条链有能量系统（持有 ≥ 30,000 ATOS 可获得免 gas 额度）。质押出去的 ATOS **仍然计入**额度计算 —— 币还是用户的。用户普遍会担心这点，质押确认弹窗里要明说。

---

## 关键链上参数

全部从链上读，代码里不写死 —— 治理改了参数页面要跟着变。

| 参数 | 当前值 | 影响 |
|---|---|---|
| `unbonding_time` | 21 天 | 解质押等待期，不可取消不可加速 |
| `max_entries` | 7 | 同一验证人下最多 7 笔在途解质押，第 8 笔会失败 |
| `min_commission_rate` | 5% | 链上强制，不存在低于 5% 的验证人 |
| `validator_min_self_delegation` | 1 亿 ATOS | 成为验证人的自质押门槛 |
| `max_validators` | 100 | 超出的进不了活跃集 |
| `slash_fraction_downtime` | 1% | 掉线罚没，监禁 10 分钟 |
| `slash_fraction_double_sign` | 5% | 双签罚没 |

罚没时**委托人与验证人同比例承担损失** —— 选择验证人之后、确认之前必须提示。

---

## 数据来源：mock 和 chain 两种模式

```
VITE_API_MODE=mock    内置模拟数据，不需要节点（默认）
VITE_API_MODE=chain   连真链的 Cosmos REST，需要 VITE_REST_URL
```

保留 mock 不是为了图方便：测试网目前只对外暴露了 EVM JSON-RPC（`https://rpc-testnet.atoshi.org`，端口 8545），而**质押数据全在 Cosmos 模块里，EVM JSON-RPC 一个都读不到** —— 没有任何 `eth_*` 方法能查 `cosmos/staking/v1beta1/validators`。

等节点把 Cosmos REST（`app.toml` 的 `[api]`，默认 1317）暴露出来，把 `VITE_API_MODE` 改成 `chain` 即可，UI 代码不用动。

> 显式设了 `chain` 却没给 `VITE_REST_URL` 时会**直接抛错**，不会静默退回 mock。静默退回会让页面显示一堆假数据而看起来一切正常，是最难排查的一种故障。

### 怎么确认 REST 地址对不对

```bash
curl https://<你的地址>/cosmos/base/tendermint/v1beta1/node_info
```

返回 JSON 就对了。返回 `404 page not found` 说明那是 EVM JSON-RPC 或 CometBFT RPC，不是 REST。

---

## 代码结构

```
src/
  services/
    stakingApi.ts        切换层。UI 只 import 这个，不关心数据来自哪
    stakingApiMock.ts    模拟数据实现
    stakingApiChain.ts   真链实现（Cosmos REST）+ 钱包签名接入点
    chainRest.ts         REST 客户端、单位换算工具
  components/
    OverviewTab.tsx      概览：资产卡 + 我的委托
    ValidatorsTab.tsx    验证人列表
    UnbondingTab.tsx     解质押中 / 记录
    modals/              质押、解质押、转委托、领取、验证人详情、ATOX 说明、能量说明
  i18n/                  中英双语
  types.ts               与链上字段严格对应的类型定义
  utils/format.ts        金额格式化
```

### 单位与精度

- 链上最小单位是 **liao**，1 ATOS = 10^18 liao
- ATOX 最小单位是 **aatox**，1 ATOX = 10^18 aatox
- 接口返回的都是最小单位的整数字符串
- **一律用 `BigInt` 处理，不要用 `Number`** —— 10^26 这个量级会精度丢失

有一个容易踩的坑：`distribution` 模块返回的是 **DecCoin**（放大 10^18 的定点数），而委托金额是 **Coin**（整数）。混用会差 10^18 倍。`chainRest.ts` 里的 `decCoinToInt` 负责这个换算。

---

## 写操作需要钱包

`delegate` / `undelegate` / `redelegate` / `withdrawRewards` 需要签名，走钱包注入的 bridge，不走 REST：

```ts
window.atoshiWallet = {
  getAddress(): Promise<string>,
  signAndBroadcast(msgs: unknown[], memo?: string): Promise<{ tx_hash: string }>,
}
```

宿主（Atoshi 钱包）在 WebView 里注入这个对象。没注入时这四个方法会**抛出明确的错误**，而不是返回一个假的 tx_hash。

Msg 类型用标准的 Cosmos 类型：

| 操作 | typeUrl |
|---|---|
| 质押 | `/cosmos.staking.v1beta1.MsgDelegate` |
| 解质押 | `/cosmos.staking.v1beta1.MsgUndelegate` |
| 转委托 | `/cosmos.staking.v1beta1.MsgBeginRedelegate` |
| 领取奖励 | `/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward` |

「全部领取」需要为每个有委托的验证人各发一条 Msg —— 链上没有「一次领全部」的单条消息。

---

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

默认是 mock 模式，不需要节点。

连真链：

```bash
# .env
VITE_API_MODE=chain
VITE_REST_URL=https://api-testnet.atoshi.org
VITE_DEMO_ADDRESS=atoshi1...        # 只读查询用
```

```bash
npm run build        # 产物在 dist/
npm run preview      # 本地预览构建产物
```

---

## 已知待办

- **交易历史**（`getHistory`）真链模式下返回空。链上没有「某地址的质押操作历史」这个查询，要靠 tx 事件索引拼，而 REST 的 `/cosmos/tx/v1beta1/txs?query=` 在不同版本语法不一致。建议后端做一个索引服务，前端读一个稳定接口。
- **验证人列表里的自质押**用的是 `min_self_delegation`（验证人申报的下限），不是真实自质押量。真实值需要按地址再查一次委托，列表里逐个查会放大成 N 次请求。详情弹窗里应该查真实值。
- **在线率**依赖 `slashing/signing_infos`，而它用的是共识地址、`validators` 用的是 operator 地址，两者的映射需要 pubkey 换算，前端做不了。拿不到时降级显示 100%，需要后端补一个映射或直接给在线率。
- **`USER_ADDRESS` 目前是常量**。接钱包后应该换成从 bridge 拿地址的 hook，改动面在 `App.tsx`。

---

## 视觉约定

白底、浅灰分隔线、圆角卡片、移动端竖屏优先（375–430px），无深色模式 —— 与钱包内其他页面（如隐私交易）保持一致。金额用等宽数字字体。
