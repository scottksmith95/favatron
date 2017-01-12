rm cleanup.zip
rm -rf webjob_cleanup

mkdir webjob_cleanup
mkdir webjob_cleanup/config
mkdir webjob_cleanup/models
mkdir webjob_cleanup/node_modules
mkdir webjob_cleanup/node_modules/async
mkdir webjob_cleanup/node_modules/distill
mkdir webjob_cleanup/node_modules/mongoose
mkdir webjob_cleanup/node_modules/request

cp -r config webjob_cleanup
cp -r models webjob_cleanup
cp -r node_modules/async webjob_cleanup/node_modules
cp -r node_modules/distill webjob_cleanup/node_modules
cp -r node_modules/mongoose webjob_cleanup/node_modules
cp -r node_modules/request webjob_cleanup/node_modules

cp webjob_cleanup.js webjob_cleanup/run.js

cd webjob_cleanup

zip -r ../cleanup.zip ./

cd ..

rm -rf webjob_cleanup




rm email.zip
rm -rf webjob_email

mkdir webjob_email
mkdir webjob_email/config
mkdir webjob_email/models
mkdir webjob_email/node_modules
mkdir webjob_email/node_modules/async
mkdir webjob_email/node_modules/distill
mkdir webjob_email/node_modules/mongoose
mkdir webjob_email/node_modules/sendgrid

cp -r config webjob_email
cp -r models webjob_email
cp -r node_modules/async webjob_email/node_modules
cp -r node_modules/distill webjob_email/node_modules
cp -r node_modules/mongoose webjob_email/node_modules
cp -r node_modules/sendgrid webjob_email/node_modules

cp webjob_email.js webjob_email/run.js

cd webjob_email

zip -r ../email.zip ./

cd ..

rm -rf webjob_email





rm process.zip
rm -rf webjob_process

mkdir webjob_process
mkdir webjob_process/config
mkdir webjob_process/models
mkdir webjob_process/node_modules
mkdir webjob_process/node_modules/async
mkdir webjob_process/node_modules/cardi
mkdir webjob_process/node_modules/distill
mkdir webjob_process/node_modules/mongoose
mkdir webjob_process/node_modules/readability-api
mkdir webjob_process/node_modules/request
mkdir webjob_process/node_modules/underscore
mkdir webjob_process/node_modules/url-expand
mkdir webjob_process/temp

cp -r config webjob_process
cp -r models webjob_process
cp -r node_modules/async webjob_process/node_modules
cp -r node_modules/cardi webjob_process/node_modules
cp -r node_modules/distill webjob_process/node_modules
cp -r node_modules/mongoose webjob_process/node_modules
cp -r node_modules/readability-api webjob_process/node_modules
cp -r node_modules/request webjob_process/node_modules
cp -r node_modules/underscore webjob_process/node_modules
cp -r node_modules/url-expand webjob_process/node_modules
cp -r temp webjob_process

cp webjob_process.js webjob_process/run.js

cd webjob_process

zip -r ../process.zip ./

cd ..

rm -rf webjob_process





rm twitter.zip
rm -rf webjob_twitter

mkdir webjob_twitter
mkdir webjob_twitter/config
mkdir webjob_twitter/models
mkdir webjob_twitter/node_modules
mkdir webjob_twitter/node_modules/async
mkdir webjob_twitter/node_modules/distill
mkdir webjob_twitter/node_modules/escape-html
mkdir webjob_twitter/node_modules/mongoose
mkdir webjob_twitter/node_modules/twit
mkdir webjob_twitter/node_modules/underscore

cp -r config webjob_twitter
cp -r models webjob_twitter
cp -r node_modules/async webjob_twitter/node_modules
cp -r node_modules/distill webjob_twitter/node_modules
cp -r node_modules/escape-html webjob_twitter/node_modules
cp -r node_modules/mongoose webjob_twitter/node_modules
cp -r node_modules/twit webjob_twitter/node_modules
cp -r node_modules/underscore webjob_twitter/node_modules

cp webjob_twitter.js webjob_twitter/run.js

cd webjob_twitter

zip -r ../twitter.zip ./

cd ..

rm -rf webjob_twitter