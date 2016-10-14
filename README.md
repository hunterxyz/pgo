# pgo (temporary name)

npm install

cd node_modules/pokemongo-api/

npm install

#Setup

### set as local environment the following variables:

> PGO_USERNAME

> PGO_PASSWORD

> LATITUDE

> LONGITUDE

#How to Run

##Linux

node app.js

###if you haven't set environment variables you can run the command as following:

node PGO_USERNAME=[bot_username] PGO_PASSWORD=[bot_password] LATITUDE=[latitude] LONGITUDE=[longitude] app.js

##Windows

###on windows you need .NET framework to compile **pokemongo-api** module

add the environment variables as Windows wants

node app.js
