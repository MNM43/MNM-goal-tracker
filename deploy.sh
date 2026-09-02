#!/usr/bin/env bash
# 部署到 GitHub Pages（gh-pages 分支）
# 用法（在仓库根目录执行）:
#   GH_TOKEN=ghp_xxx ./deploy.sh
# 可选环境变量: REPO（默认 MNM-goal-tracker）、GH_USER（默认 MNM43）
set -euo pipefail

: "${GH_TOKEN:?请先设置环境变量 GH_TOKEN（GitHub Personal Access Token，需 repo 权限）}"
REPO="${REPO:-MNM-goal-tracker}"
GH_USER="${GH_USER:-MNM43}"

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
git push "https://$GH_USER:$GH_TOKEN@github.com/$GH_USER/$REPO.git" gh-pages --force

echo "✅ 已发布到 https://$GH_USER.github.io/$REPO/"
