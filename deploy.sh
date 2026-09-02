#!/usr/bin/env bash
# 部署到 GitHub Pages（gh-pages 分支）
#
# 认证方式（二选一，优先 SSH，免令牌更安全）:
#   A. SSH（推荐）: 本机已把 SSH 公钥加到 GitHub，直接运行：
#        ./deploy.sh
#   B. 令牌: 未配置 SSH 时，用令牌（仅本次终端使用，不写入文件）：
#        GH_TOKEN=ghp_xxx ./deploy.sh
#
# 可选环境变量: REPO（默认 MNM-goal-tracker）、GH_USER（默认 MNM43）
set -euo pipefail

REPO="${REPO:-MNM-goal-tracker}"
GH_USER="${GH_USER:-MNM43}"

# 选远程地址：有令牌走 HTTPS，否则走 SSH（免令牌）
if [ -n "${GH_TOKEN:-}" ]; then
  REMOTE="https://$GH_USER:$GH_TOKEN@github.com/$GH_USER/$REPO.git"
  echo "▶ 使用 HTTPS + 令牌 认证"
else
  REMOTE="git@github.com:$GH_USER/$REPO.git"
  echo "▶ 使用 SSH 认证（git@github.com:$GH_USER/$REPO.git）"
fi

echo "▶ 构建生产包..."
npm run build

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -r dist/. "$TMP/"

echo "▶ 发布到 gh-pages 分支..."
cd "$TMP"
git init -q
git config user.name "$GH_USER"
git config user.email "$GH_USER@users.noreply.github.com"
git config commit.gpgsign false
git add -A
git commit -q -m "deploy: $(date +%Y%m%d%H%M)"
git branch -M gh-pages
git push "$REMOTE" gh-pages --force

echo "✅ 已发布到 https://$GH_USER.github.io/$REPO/"
