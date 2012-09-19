test:
	@./node_modules/.bin/mocha \
		--reporter spec \
		--bail \
		--timeout 60s \
		--require test/common.js

.PHONY: test