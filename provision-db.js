const { Client } = require('ssh2');
const fs = require('fs');

const composeFile = fs.readFileSync('infra/docker-compose.yml', 'utf8');
const envFile = `POSTGRES_USER=admin\nPOSTGRES_PASSWORD=SuperSecretAdminPassword123!\nPOSTGRES_DB=petboss\n`;

const setupScript = `
#!/bin/bash
set -e
echo "Updating apt..."
apt-get update -y
echo "Installing Docker..."
apt-get install -y docker.io docker-compose
systemctl enable docker
systemctl start docker
echo "Creating infra dir..."
mkdir -p /root/infra
echo "Writing docker-compose.yml..."
cat << 'EOF' > /root/infra/docker-compose.yml
${composeFile}
EOF
echo "Writing .env..."
cat << 'EOF' > /root/infra/.env
${envFile}
EOF
echo "Starting containers..."
cd /root/infra
docker compose up -d
docker ps
`;

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(setupScript, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '95.179.243.160',
  port: 22,
  username: 'root',
  password: 'tV.2xx-czKB#chKr'
});
