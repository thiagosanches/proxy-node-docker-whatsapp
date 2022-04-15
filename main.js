const express = require('express')
const bodyParser = require('body-parser')
const fs = require('fs');
const uuid = require('uuid');

const { exec } = require('child_process');
const username = process.env.APP_USER ? process.env.APP_USER : process.exit(-1);

const app = express()
app.use(bodyParser.json())

app.post('/sendMessage', function (req, res) {
  const { name, body } = req.body;

  const fileTemplate = fs.readFileSync(`/home/${username}/app/sikulixide.template.py`, 'utf8')
  const fileContent = fileTemplate.replace("@NAME", name).replace("@BODY", body);
  const fileName = `${uuid.v4()}.sikulix.py`;
  fs.writeFileSync(fileName, fileContent, { encoding: "utf8" });

  console.log(fileName);
  console.log(fileContent);

  exec(`java -jar /home/${username}/sikulixide-2.0.5.jar -r ${fileName}`, (error, stdout, stderr) => {
    if (error) {
      console.log(error)
    }

    if (stderr) {
      console.log(stderr)
    }

    console.log(stdout)
  })
  res.send('OK');
})

app.post('/sendMessages', function (req, res) {

  const fileTemplate = fs.readFileSync(`/home/${username}/app/sikulixide.template.py`, 'utf8')
  const fileName = `${uuid.v4()}.sikulix.py`;

  let fileContent = "";
  const data = req.body;
  for (var i = 0; i < data.length; i++) {
    fileContent += fileTemplate.replace("@NAME", data[i].name).replace("@BODY", data[i].body) + "\n";
  }

  fs.writeFileSync(fileName, fileContent, { encoding: "utf8" });

  console.log(fileName);
  console.log(fileContent);

  exec(`java -jar /home/${username}/sikulixide-2.0.5.jar -r /home/${username}/app/${fileName}`, (error, stdout, stderr) => {
    if (error) {
      console.log(error)
    }

    if (stderr) {
      console.log(stderr)
    }

    console.log(stdout)
  })
  res.send('OK');
})

app.listen(3000)
