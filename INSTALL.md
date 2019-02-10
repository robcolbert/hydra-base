# HYDRA Platform

## Host Setup (dev)

### MongoDB Installation

First, remove any existing MongoDB deployment(s):

    apt-get remove mongodb mongodb-clients mongodb-server

Next, install MongoDB from packages maintained by MongoDB themselves:

    sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4
    echo "deb http://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.0.list
    sudo apt-get update
    sudo apt-get install -y mongodb-org

### Redis Installation

Next, install Redis:

    sudo apt-get install redis-server

### Node.js Installation

Next, install Node.js from packages maintained by Node.js:

    apt-get install -y python gcc g++ make
    cd /opt
    wget https://nodejs.org/dist/v8.12.0/node-v8.12.0-linux-x64.tar.xz
    tar -xf node-v8.12.0-linux-x64.tar.xz
    ln -s node-v8.12.0-linux-x64 node
    vi /etc/profile
        [at end of file]
        PATH=$PATH:/opt/node/bin
        export PATH

Now, as the root user, please make sure Node.js can start:

    node

As the root user, please install the global Node.js management requirements:

    npm install -g yarn gulp forever

### HYDRA Front-End Application Setup

As the root user:

    adduser hydra [answer questions]
    su - hydra
    ssh-keygen
    cat .ssh/id_rsa.pub

This will print your SSH key. Please add the SSH key to github in Settings -> New SSH Key.

The HYDRA front-end application server needs to know the environment in which it
is being executed.

    vi ~/.bashrc
      [at end of file]
      NODE_ENV="local"
      export NODE_ENV

Next, as the github user:

    git clone https://github.com/robcolbert/hydra-base.git [your-project-name]
    cd [your-project-name]
      yarn
      gulp