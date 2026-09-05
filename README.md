# Atoshi Staking DApp

Atoshi 链的质押 DApp，以 WebView 形式嵌入 Atoshi 钱包。

覆盖质押 / 追加质押 / 解除质押 / 转委托 / 领取奖励全流程，以及验证人列表与详情。

---

## 三处与常规 Cosmos 链不同的地方

这三条决定了界面上必须讲清楚什么，改代码前先看懂：

**1. 质押 ATOS，奖励是 ATOX，不是 ATOS。**

这条链是双币设计。ATOS 是 gas 币和质押币；ATOX 是每个区块产出的挖矿奖励币，按质押比例分给验证人和委托人。所以「待领奖励」那一栏的单位是 **ATOX**。

链上 `inflation` 是关闭的，不铸 ATOS。所以收益率不能用「通胀率 ÷ 质押率」那套公式算 —— 那会算出 0。按 ATOX 的发行速率算：

```
收益率 = 每年 ATOX 产出 × (1 - 佣金率) / 全网总质押
```

**这个数是 ATOX/ATOS，不是百分比 —— 界面上不要加百分号。** 分子是 ATOX，分母是 ATOS，两个不同的币，比值写不成百分号（百分比要求分子分母同单位）。也换不成百分比：ATOX 没有市场价（它按兑换池比例结算成 ATOS，比例随池子变），oracle 只喂 ATOS 的价。

实测（块高 2400，全网质押 4 亿）这个比值是 **78.13 ATOX/ATOS**。写成 `7031%` 会让用户以为一年翻 70 倍。

一个反直觉的结论：委托人的收益率只取决于佣金率和全网总质押，跟选哪个验证人无关。推导见 `src/services/stakingApiChain.ts` 里 `estimateAprAtox` 的注释。

还有一个坑：每块产出要读 `/atoshi/tokenomics/v1/block_reward` 的 `current_reward`（链算好的当前值，已含减半），**不能**用 `tokenomics/params` 里的 `initial_block_reward`（创世值，每过一个减半周期就偏高一倍）。

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

## 架构：读走 REST，写走 EVM 预编译

这是这个项目最需要先看懂的一点。

```
        ┌──────────────── 读 ────────────────┐
页面 ──> Cosmos REST (1317)  /rest-api/cosmos/staking/...
        验证人、委托、奖励、解质押、能量、ATOX

        ┌──────────────── 写 ────────────────┐
页面 ──> 钱包签名 ──> EVM 交易 ──> 预编译 0x…0800 / 0x…0801
        质押、解质押、转委托、领取奖励
```

**为什么写不能走 REST**：质押是 Cosmos 消息（`MsgDelegate`），MetaMask 这类
以太坊钱包签不了 —— 它只会签以太坊交易。

**为什么能用普通 EVM 钱包**：链上开了 staking 和 distribution 两个预编译
（`atoshid q evm params` 里的 `active_static_precompiles` 能看到），于是质押
变成一笔往 `0x…0800` 的普通合约调用，任何 EVM 钱包都能签。

| UI 操作 | 合约调用 |
|---|---|
| 质押 | `0x…0800` `delegate(delegator, "atoshivaloper1…", amount)` |
| 解质押 | `0x…0800` `undelegate(...)` → 返回完成时间 |
| 转委托 | `0x…0800` `redelegate(delegator, src, dst, amount)` |
| 领取（单个） | `0x…0801` `withdrawDelegatorRewards(delegator, validator)` |
| 领取（全部） | `0x…0801` `claimRewards(delegator, maxRetrieve)` |

`claimRewards` 一笔交易领全部。Cosmos 那边没有对应的单条消息（得为每个验证人
各发一条 `MsgWithdrawDelegatorReward`），预编译这里合成了一个。

**为什么读不走预编译**：预编译的 view 方法一次只能查一个验证人，而且拿不到
在线率、解质押完成时间这些只有 REST 才给的字段。列表页用 REST 一次拿全量便宜得多。

### 地址的两种表示

Atoshi 是 Ethermint 系的链，一个账户同时有两种地址，同一个私钥派生：

```
0x37970e3980ad34bdbf88b536af243f6795bc665e     ← 钱包给的，预编译调用要这个
atoshi1x7tsuwvq456tm0ugk5m27fplv72mcej7kx2pll  ← REST 查询路径要这个
```

`src/wallet/chain.ts` 里的 `hexToBech32` / `bech32ToHex` 负责互转，纯前端算，
不用问链。**少了这层换算，读和写就对不上同一个账户** —— 页面显示 A 的委托，
交易签给 B。

验证人地址是 `atoshivaloper1…`，**52 个字符**（不是 51）。

---

## 数据来源：mock 和 chain 两种模式

```
VITE_API_MODE=mock    内置模拟数据，不需要节点
VITE_API_MODE=chain   连真链（默认）
```

mock 模式只在显式配置时启用，给产品和设计看页面用，不需要节点也不需要钱包。

> 未配置 `VITE_API_MODE` 时也会连接真链，绝不会静默退回 mock。否则页面会显示
> 一堆与当前钱包无关的假数据，看起来却像真实账户数据。

### 怎么确认 REST 地址对不对

```bash
curl https://rpc-testnet.atoshi.org/rest-api/cosmos/base/tendermint/v1beta1/node_info
```

返回 JSON 就对了。返回 `404 page not found` 说明填成了 EVM JSON-RPC（8545）
或 CometBFT RPC（26657）。

注意测试网的 REST 是挂在 **`/rest-api/` 子路径**下反代的，不是独立域名。

---

## 钱包连接

用 wagmi + `injected()` connector，没有 RainbowKit / MetaMask SDK。

在 Atoshi 钱包内（WebView）：钱包注入 `window.ethereum`（安卓端见
`assets/dapp_provider.js`，标准 EIP-1193 + EIP-6963），**自动连接，不弹窗** ——
用户已经在钱包里了，再要求点一次「连接钱包」是多余的一步。

在第三方钱包的内置浏览器里（MetaMask / OKX / TokenPocket / imToken / Bitget /
Trust）：同样走注入，但**不自动连** —— 那属于「授权把地址给这个网站」，
应该由用户主动触发。

钱包连接后，地址栏右侧提供断开按钮。断开会清除当前连接状态和所有个人账户数据；
Atoshi WebView 在本次页面会话内不会立即自动重连。

**为什么不用 RainbowKit**：实测加上它的全套 connector 让打包从 99 kB gzip 涨到
**1420 kB**，大头是 MetaMask SDK（558 kB）和 Coinbase SDK。那两个 SDK 是给
「桌面浏览器没装插件、扫码连手机钱包」这个场景用的，跟钱包内嵌完全不沾。
为一个几乎不会走的路径付 14 倍体积，在移动端 WebView 里不划算。

以后确实需要扫码连接时，正确做法是把 WalletConnect 做成点击时 `dynamic import`
的懒加载模块，而不是塞进首屏 bundle。

验证人、质押参数、ATOX 全局状态等**公共数据**不需要连接钱包。余额、委托、奖励、
解质押、能量和个人记录只在钱包连接后按真实地址查询；未连接时这些个人数据为 0
或空列表。只有四个写操作需要签名。

---

## 代码结构

```
src/
  services/
    stakingApi.ts        切换层。UI 只 import 这个，不关心数据来自哪
    stakingApiMock.ts    模拟数据实现
    stakingApiChain.ts   真链实现：REST 读 + 预编译写
    chainRest.ts         REST 客户端、单位换算工具
  wallet/
    chain.ts             viem chain 定义 + bech32↔hex 地址换算
    config.ts            wagmi 配置（injected connector）
    precompiles.ts       预编译地址、ABI、gas 上限
    useWallet.ts         页面拿账户只用这一个 hook
    WalletProvider.tsx   包在 App 外面
  components/
    WalletBar.tsx        连接按钮 / 错链提示
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

## 写操作的两个约束

**1. 必须等回执，不能拿到 hash 就返回。**

预编译调用失败时交易照样上链，只是 `status = 'reverted'`。不检查的话 UI 会
显示「质押成功」而链上什么都没发生。`sendTx` 里统一做了这个检查。

**2. gas 给固定上限，不用估算。**

预编译的 `eth_estimateGas` 实测偏低约 2%（链侧已记录为待办事项），偏低会直接
让交易 out of gas。多给的 gas 不会被扣 —— EVM 只按实际消耗收费。上限见
`src/wallet/precompiles.ts` 的 `GAS_LIMITS`。

另外页面会校验「UI 上的账户」和「钱包当前账户」是否一致，不一致直接报错 ——
链上不允许替别人质押，让它在签名前就失败比在链上 revert 好。

---

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

`.env.example` 默认就是 chain 模式连测试网。想看 mock 数据把 `VITE_API_MODE`
改成 `mock`。

环境变量是**构建期**注入的（Vite 的 `import.meta.env`），不是运行期读的 ——
改了 `.env` 必须重新 `npm run build`，改服务器上 `dist/` 里的文件没有用。

```bash
npm run build        # 产物在 dist/
npm run preview      # 本地预览构建产物
```

---

## 已知待办

- **交易历史**（`getHistory`）通过 Blockscout API 获取账户交易，再按质押与奖励预编译 ABI 解码。浏览器索引不可用时会降级为空列表；生产环境可通过 `VITE_EXPLORER_API_URL` 指向稳定的索引服务。
- **验证人列表里的自质押**用的是 `min_self_delegation`（验证人申报的下限），不是真实自质押量。真实值需要按地址再查一次委托，列表里逐个查会放大成 N 次请求。详情弹窗里应该查真实值。
- **在线率**依赖 `slashing/signing_infos`，而它用的是共识地址、`validators` 用的是 operator 地址，两者的映射需要 pubkey 换算，前端做不了。拿不到时降级显示 100%，需要后端补一个映射或直接给在线率。
- **收益率的单位是 ATOX/ATOS，不是百分比**，见上文。这不是待办，是设计如此，
  但每个改这块 UI 的人都会想加上百分号，所以记在这里。
- **扫码连接钱包**（WalletConnect）没做。见上文「钱包连接」一节的取舍。

---

## 视觉约定

白底、浅灰分隔线、圆角卡片、移动端竖屏优先（375–430px），无深色模式 —— 与钱包内其他页面（如隐私交易）保持一致。金额用等宽数字字体。
