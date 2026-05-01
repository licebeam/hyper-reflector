## Welcome to Hyper Reflector

I'll add additional details about how to contribute and build later.


# Setup
- Install Node.js, at least version 20.  It is recommened that you use nvm or nvm-windows so that you can do side-by-side installs of different node versions.  An installer can be found here:

    https://github.com/coreybutler/nvm-windows/releases

If you chose to install nvm, use the following command:
```
nvm install 20
nvm use 20
```

- Install Rust: https://rust-lang.org/tools/install/
- Install node packages:
```
cd Hyper-Reflector
npm install
```

# Run
Now you can run Hyper Reflector in dev mode:
```
npm run tauri dev
```