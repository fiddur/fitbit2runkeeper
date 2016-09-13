
all: data data/users.json data/accounts.json

data:
	mkdir data

data/users.json:
	touch data/users.json

data/accounts.json:
	touch data/accounts.json
