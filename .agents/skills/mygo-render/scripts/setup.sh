#!/bin/sh
# Sets up a Go module with the mygo render plugin.
# Usage: setup.sh <dir> [module-name]
set -e
dir="${1:?usage: setup.sh <dir> [module-name]}"
name="${2:-$(basename "$dir")}"
mkdir -p "$dir"
cd "$dir"
go mod init "$name"
go get github.com/egoist/mygo/plugins/render
echo "module ready in $dir — write main.go and run: go run ."
