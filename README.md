# The-campus-market

## 鐢熶骇閮ㄧ讲

椤圭洰宸茬粡琛ラ綈浜嗗鍣ㄥ寲閮ㄧ讲鍩哄骇锛?
- `client/Dockerfile`
- `server/Dockerfile`
- `docker-compose.yml`
- `deploy/nginx/*`
- `deploy/certbot/entrypoint.sh`

閮ㄧ讲鏋舵瀯锛?
- `mysql`
    - MySQL 鏁版嵁搴?- `server1`
    - Node.js 鍚庣瀹炰緥 1
- `server2`
    - Node.js 鍚庣瀹炰緥 2
- `frontend`
    - 鍓嶇闈欐€佺珯鐐瑰鍣?- `nginx`
    - 缁熶竴鍏ュ彛
    - 璐熻矗鍓嶇闈欐€佷唬鐞?    - 璐熻矗 `/api`銆乣/ws`銆乣/uploads` 鍙嶅悜浠ｇ悊
    - 璐熻矗瀵?`server1`銆乣server2` 鍋氳礋杞藉潎琛?- `certbot`
    - Let's Encrypt 璇佷功鐢宠鍜岃嚜鍔ㄧ画鏈?
## 鍚姩鍓嶅噯澶?
1. 澶嶅埗鐜鍙橀噺妯℃澘

```powershell
copy .env.example .env
```

2. 淇敼 `.env`

鏈€灏戣鏀硅繖浜涳細

- `MYSQL_ROOT_PASSWORD`
- `JWT_SECRET`
- `DOMAINS`
- `LETSENCRYPT_EMAIL`

璇存槑锛?
- `DOMAINS`
    - 澶氫釜鍩熷悕鐢ㄨ嫳鏂囬€楀彿鍒嗛殧
    - 渚嬪 `example.com,www.example.com`
- `ENABLE_HTTPS`
    - 鏈湴娴嬭瘯鍙涓?`false`
    - 姝ｅ紡涓婄嚎寤鸿璁句负 `true`
- `LETSENCRYPT_STAGING`
    - 棣栨璋冭瘯璇佷功鐢宠娴佺▼鏃跺彲璁句负 `true`
    - 姝ｅ紡涓婄嚎鍓嶆敼鍥?`false`

3. 濡傛灉寮€鍚?HTTPS锛屽厛纭锛?
- 鍩熷悕宸茶В鏋愬埌鏈嶅姟鍣ㄥ叕缃?IP
- 鏈嶅姟鍣ㄥ凡鏀捐 `80` 鍜?`443` 绔彛

## 涓€閿惎鍔?
```powershell
docker compose up -d --build
```

棣栨鍚姩鏃朵細鑷姩瀹屾垚锛?
- MySQL 鍒濆鍖?- 鍚庣寤鸿〃
- 鍓嶇鏋勫缓
- Nginx 鍙嶅悜浠ｇ悊鍚姩
- `certbot` 璇佷功鐢宠鍜岀画鏈熷惊鐜?
濡傛灉锛?
- `ENABLE_HTTPS=false`
    - Nginx 浼氬厛浠?HTTP 妯″紡鍚姩
- `ENABLE_HTTPS=true`
    - Nginx 浼氬厛鎻愪緵 HTTP 鍜?ACME challenge
    - 璇佷功绛惧彂鎴愬姛鍚庝細鑷姩鍒囧埌 HTTPS 閰嶇疆

## 甯哥敤鍛戒护

鏌ョ湅鏈嶅姟鐘舵€侊細

```powershell
docker compose ps
```

鏌ョ湅鏃ュ織锛?
```powershell
docker compose logs -f
```

鍙湅 Nginx锛?
```powershell
docker compose logs -f nginx
```

鍙湅璇佷功鐢宠锛?
```powershell
docker compose logs -f certbot
```

鍋滄鏈嶅姟锛?
```powershell
docker compose down
```

淇濈暀鏁版嵁鐨勫墠鎻愪笅閲嶅缓锛?
```powershell
docker compose up -d --build
```

## 鎸佷箙鍖栨暟鎹?
浠ヤ笅鏁版嵁閫氳繃 Docker Volume 鎸佷箙鍖栵細

- `mysql_data`
    - MySQL 鏁版嵁
- `server_uploads`
    - 鐢ㄦ埛涓婁紶鍥剧墖
- `certbot_www`
    - ACME challenge 鏂囦欢
- `letsencrypt`
    - HTTPS 璇佷功

## 鏁版嵁澶囦唤涓庢仮澶?
椤圭洰宸茬粡琛ヤ簡鍙墽琛岀殑澶囦唤涓庢仮澶嶈剼鏈細

- [create-backup.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\create-backup.sh)
- [restore-backup.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\restore-backup.sh)

榛樿澶囦唤鍐呭锛?
- MySQL 涓氬姟搴?- 涓婁紶鏂囦欢鐩綍

鎵ц澶囦唤锛?
```bash
sh deploy/backup/create-backup.sh
```

鎵ц鎭㈠锛?
```bash
sh deploy/backup/restore-backup.sh backups/20260602-120000 --force
```

瀹屾暣璇存槑瑙侊細

- [backup-plan.md](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\backup-plan.md)

## 鍙戝竷鍥炴粴

椤圭洰宸茬粡琛ヤ簡鍙戝竷鍓嶅揩鐓у拰蹇€熷洖婊氳剼鏈細

- [prepare-release.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\release\prepare-release.sh)
- [rollback-release.sh](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\release\rollback-release.sh)

鍙戝竷鍓嶅厛鎵ц锛?
```bash
sh deploy/release/prepare-release.sh
```

濡傛灉鏂扮増鏈紓甯革紝鎵ц锛?
```bash
sh deploy/release/rollback-release.sh release-state/releases/20260602-120000/release.env --force
```

瀹屾暣璇存槑瑙侊細

- [rollback-plan.md](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\release\rollback-plan.md)

## 璐熻浇鍧囪　璇存槑

Nginx 褰撳墠浼氭妸鍚庣娴侀噺鍒嗗彂鍒帮細

- `server1`
- `server2`

绛栫暐浣跨敤锛?
- `least_conn`

閫傜敤浜庯細

- 鏅€?API 璇锋眰
- WebSocket 鍗囩骇璇锋眰

濡傛灉鍚庣画瑕佺户缁í鍚戞墿瀹癸紝寤鸿涓嬩竴姝ユ妸鍚庣瀹炰緥鏁版敼鎴愭洿绯荤粺鐨勬湇鍔″彂鐜版柟妗堬紝鑰屼笉鏄户缁墜宸ュ鍔?`server3`銆乣server4`銆?
## 娉ㄦ剰浜嬮」

1. 杩欎釜閮ㄧ讲鏂规榛樿鍚庣杩炴帴 MySQL锛屼笉鍐嶄娇鐢?SQLite
2. WebSocket 宸查€氳繃 Nginx 閰嶇疆杞彂
3. 涓婁紶鏂囦欢鐩綍宸茬粡鍋氫簡鍏变韩鍗凤紝涓や釜鍚庣瀹炰緥涓嶄細鍚勫啓鍚勭殑
4. 棣栨鐢宠璇佷功澶辫触鏃讹紝鍏堟鏌ワ細
   - 鍩熷悕瑙ｆ瀽
   - 80 绔彛鏄惁鍙闂?   - `DOMAINS` 鏄惁濉啓姝ｇ‘
   - `LETSENCRYPT_EMAIL` 鏄惁濉啓姝ｇ‘
## 规则文档

- [内容治理规则](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\content-governance.md)
- [数据隐私与可见范围](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\data-privacy.md)

## 数据库运维

- [数据库备份与恢复说明](C:\Users\33981\Documents\MyProjects\Web\The-campus-market\deploy\backup\backup-plan.md)

