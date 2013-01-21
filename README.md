amino-deploy
============

Command-line tool to deploy an application across a cluster of drones.

[![build status](https://secure.travis-ci.org/amino/amino-deploy.png)](http://travis-ci.org/amino/amino-deploy)

About
=====

The amino deploy CLI helps you manage an army of drone servers. With it, you can
host node.js applications with increased redundancy and throughput. You'll also
have the peace of mind of of being able to start, stop, redeploy, and respawn
processes from a single console.

You might think of it as the clusterable, manageable alternative to forever.

Features
========

- Run as many drones and services as your app needs.
- Add new drones to the cluster any time, with no downtime of the live drones.
- Redeploy your application codebase to all drones, with a single command.
- Manage and monitor drones and the processes they are running.
- Zero configuration per drone server, you only need:
    - Services name
    - Redis server addresses and authentication credentials
- More...

Prerequisites
==============

This CLI works by communicating with [amino-drone](http://github.com/amino/amino-drone)
services.

Amino-deploy uses Redis to facilitate pub/sub gossip
between the drone servers and your console. You'll want at least one Redis
database or, for increased redundancy, multiple redis servers. See
[haredis](http://github.com/carlos8f/haredis) for more info.

Usage
=====

```
Usage: amino <command>

Commands:

  deploy [options] [cmd] [args...]
  deploy a project to drones and optionally spawn a command

  redeploy [options]
  deploy latest code, spawn copies of existing processes, and then stop old processes

  respawn [sha1/id]
  respawn running processes, optionally on a particular git or tarball sha1 or process id

  ps [sha1]
  show running processes, optionally on a particular git or tarball sha1

  stop [sha1/id]
  stop running processes, optionally on a particular git or tarball sha1 or process id

  config
  save arguments to .amino.yml to act as defaults

  *
  output help

Options:

  -h, --help                              output usage information
  -V, --version                           output the version number
  -s, --service <name[@version]>          drone service to request, with optional semver (default: app-drone)
  -r, --redis <port/host/host:port/list>  redis server(s) used by the service (can be comma-separated)
```

- - -

### Developed by [Terra Eclipse](http://www.terraeclipse.com)
Terra Eclipse, Inc. is a nationally recognized political technology and
strategy firm located in Aptos, CA and Washington, D.C.

- - -

### License: MIT

- Copyright (C) 2012 Carlos Rodriguez (http://s8f.org/)
- Copyright (C) 2012 Terra Eclipse, Inc. (http://www.terraeclipse.com/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the &quot;Software&quot;), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
