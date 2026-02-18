build-SharedUtilsLayer:
	@if not exist "$(ARTIFACTS_DIR)/nodejs" mkdir "$(ARTIFACTS_DIR)/nodejs"
	@robocopy node_modules "$(ARTIFACTS_DIR)/nodejs/node_modules" /E /IS /IT 2>nul || exit /b 0
	@copy /Y package.json "$(ARTIFACTS_DIR)/nodejs/package.json" 2>nul || exit /b 0
	@echo Compiling TypeScript with bun...
	@bunx tsc --project tsconfig.json
	@robocopy dist "$(ARTIFACTS_DIR)/nodejs/src" /E 2>nul || exit /b 0
