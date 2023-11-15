Muon Optimistic Node in a JS implementation of the warrantor and supervisor nodes of the Muon Optimistic Network.

## Install

```
$ git clone https://github.com/siftal/muon-optimistic-node.git
$ npm install
```

## Configure

```
cp .env.example .env
```
Edit the file and set:
- `NETWORK`
- `COLLATERAL_MANAGER`
- `WARRANTOR_ADDRESS` and `WARRANTOR_PRIVATE_KEY` if you are running a warrantor node
- `SUPERVISOR_ADDRESS` and `SUPERVISOR_PRIVATE_KEY` if you are running a supervisor node

For running a supervisor node, set list of warrantor nodes wallet and API addresses in the `data/warrantors.json`.

## Run

Copy your MuonApps to `muon-apps` directoy.

Run a warrantor node using:

```
nodejs warrantor.js
```

Run a supervisor node using:

```
nodejs supervisor.js
```
