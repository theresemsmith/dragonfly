"""
enable extensions in hgrc

[extensions]
extension = <path to>/extension.py

[hooks] 
<command> = python:<extension>.<function>

"""

import sys, os, time

if sys.platform == "win32":
    import os, msvcrt
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)

INI_JS = "ini.js"
BUILD_CONFIG = "C:\\docs\\build-df\\build_config"
APACHE_ROOT_DIRECTORY = 'dragonfly.opera.com'


def parse_config(path):
    try:
        f = open(path, 'r')
        lines = f.readlines()
        f.close()
    except Exception, m:
        print "loading build config failed. ", m
        return None
    ret = {}
    cursor = None
    def set_cursor(dict):
        if dict != None:
            parent = dict.has_key('_parent') and ret.has_key(dict['_parent']) \
                and ret[ dict.pop('_parent') ] or ret

            parent[ dict.pop('_name') ] = dict
            if dict.has_key('short'):
                for s in dict.pop('short'):
                    if s: 
                        parent[s] = dict
        return {}
    for line in lines:
        if "#" in line: 
            continue
        if "[" in line and "]" in line:
            cursor = set_cursor(cursor)
            if ":" in line:
                parent, key = line.split(":", 1)
                cursor["_name"] = key.strip(" []\n\r")
                cursor["_parent"] = parent.strip(" []\n\r")
            else:
                cursor["_name"] = line.strip(" []\n\r")
        if "=" in line and cursor != None :
            key, value = line.split("=", 1)
            if "," in value:
                cursor[ key.strip(" \n\r") ] = [v.strip(" \n\r") for v in value.split(',')]
            else:
                cursor[ key.strip(" \n\r") ] = value.strip(" \n\r")
    set_cursor(cursor)         
    return ret


def app_revision(ui, repo, **kwargs): 
    """sets mercurial_revision in ini.js. will be displayed only if revision_number is not set"""
    import os, sys, re
    import mercurial.commands
    from mercurial.node import short
    heads = repo.heads()
    if len(heads) != 1:
        print "abort. ensure that there is only one head in the repository"
        return
    head = heads[0]
    rev = repo.changelog.rev(head)
    short_hash = short(head)
    branch = repo.dirstate.branch()
    revision = "%s:%s, %s" % (rev, short_hash, branch) 
    for dirpath, dirnames, filenames in os.walk(repo.root):
        if INI_JS in filenames:
            f = open(os.path.join(dirpath, INI_JS), 'rb')
            content = f.read()
            f.close()
            f = open(os.path.join(dirpath, INI_JS), 'wb')
            f.write(re.sub(
                re.compile("mercurial_revision:([^\n]*)\n"), 
                "mercurial_revision: \"%s\"\n" % revision, 
                content ) )
            f.close()
            break

def create_path(path):
    if not os.path.exists(path): os.makedirs(path)  

def run_build_script(ui, repo, core_version=0, type=None, tag="tip", **opts):
    """
    make a build from a configuration file.
    usage: hg build-app [-l <log range> <core version> <type, e.g. nightly>

    requires a configuration file 

    config file path defined in BUILD_CONFIG

    format example

    [general]
    server      = chrisk@is.oslo.opera.com
    scp_session = 
     
    [core 2.2]
    short       = 2.2,
    branch      = protocol-4

    [core 2.2 : nightly]
    short       = n, ce
    name        = 0.7 alpha-4-snapshot
    local-repo  = D:\apache-root\dragonfly.opera.com\app\core-2-2
    local-zip   = D:\apache-root\dragonfly.opera.com\app\core-2-2\zips\Opera-Dragonfly-%s-%s.zip
    local-log   = D:\apache-root\dragonfly.opera.com\app\core-2-2\logs\%s.%s.log
    remote-repo = /var/www/dragonfly.opera.com/app/test/

    usage hg build-app [-l sart:end] 2.2 ce
    
    meaning build application log from xx to xx for core 2.2 as a cutting-edge ( or nightly ) build

    a log of the build commands will be created in the same repo as the config file 
    """ 

    import cPickle

    if opts['command_log']:
        path = os.path.join(os.path.split(BUILD_CONFIG)[0], "BUILD_LOG")
        if os.path.exists(path):
            l = open(path, 'r')
            sys.stdout.write(l.read())
            l.close()
            return

    if opts['show_config_file']:
        if os.path.exists(BUILD_CONFIG):
            f = open(BUILD_CONFIG, 'r')
            sys.stdout.write(f.read())
            f.close()
            return

    if opts['log_history']:
        path = os.path.join(os.path.split(BUILD_CONFIG)[0], "BUILD_LOG_PICKLE")
        f = open(path, "rb")
        try:
            build_log = cPickle.load(f)
            for key in build_log: print key, ': ', build_log[key]
        except:
            pass
        f.close()
        return

    if opts['config_file']:
        print "path to config file: ", BUILD_CONFIG
        print "path to config file set in: ", __file__
        return

    log_entry = "hg build-app" +  \
        ( 'log' in opts and ( " -l " + opts['log'] ) or "" ) + \
        " " + (core_version and core_version or "")+ \
        " " + (type and type or "")
    import mercurial.commands
    from mercurial.node import short
    heads = repo.heads()
    if len(heads) != 1:
        print "abort. ensure that there is only one head in the repository"
        return
    build_config = parse_config(BUILD_CONFIG)
    if not build_config:
        print "no or broken build config file"
        return 
    os.chdir(repo.root)

    path = os.path.join(os.path.split(BUILD_CONFIG)[0], "BUILD_LOG_PICKLE")
    f = open(path, "rb")
    
    try:
        build_log = cPickle.load(f)
        build_log['read-counter'] +=1
    except:
        build_log = {'title': 'logs', 'read-counter': 0}
    f.close()
    
    head = heads[0]
    root = repo.root
    sys.path.insert(0, os.path.join(root, 'tools' ))
    
    import dfbuild
    
    core_version = core_version in build_config and build_config[core_version] or None
    type = core_version and type in core_version and core_version[type] or None
    if not type:
        print "abort. the command arguments have no according entries in the config file"
        return
    
    print "update to default branch"
    # update always to the default branch, we no longer use named branches
    if mercurial.commands.update(ui, repo, rev="default") != 0: 
        print "abort. hg update failed"
        return
    if mercurial.commands.update(ui, repo, rev=tag) != 0: 
        print "abort. hg update failed"
        return
    ctx = repo[tag] 
    rev = ctx.rev()
    short_hash = short(ctx.node())    
    revision = "%s:%s, %s, %s" % (rev, short_hash, core_version["branch"], tag)

    if not 'id' in type:
        print "each entriy in the build config must have an id"
        return

    if not type['id'] in build_log: 
        build_log[type['id']] = [] 
    build_log[type['id']].append(short_hash)

    print "make build, revision:", revision
    try:
        sys.argv = \
        [
            __file__,
            os.path.join(root, 'src'),
            type["local-repo"],
            '-t',
            '-s',
            '-d',
            '-m',
            '-b', 'app',
            '-k', '$dfversion$=' + type['name'],
            '-k', '$revdate$=' + revision
        ]
        dfbuild.main()
    except Exception, msg:
        print "abort. making build failed. ", msg
        return
    print "build created"
    try:
        import createmanifests
        sys.argv = [
            createmanifests.__file__, 
            '-d', APACHE_ROOT_DIRECTORY, 
            '-t', tag, 
            type["local-repo"]
        ]
        createmanifests.main()
        print "app cache manifests created."
    except Exception, msg:
        print "creating app cache mainfests failed.", msg
    print "make zip"
    path = type["local-zip"] % (rev, short_hash)
    create_path(os.path.split(path)[0])
    try:
        sys.argv = \
        [
            __file__,
            os.path.join(root, 'src'),
            path,
            '-c',
            '-s',
            '-d',
            '-k', '$dfversion$=' + type['name'],
            '-k', '$revdate$=' + revision
        ]
        dfbuild.main()
    except Exception, msg:
        print "abort. making zip failed. ", msg
        return
    print "zip created"
    print "make log"

    if not opts['log'] and len(build_log[type['id']]) > 1:
        opts['log'] = "tip:%s" % ( build_log[type['id']][-2] )

    if opts['log']:
        print "log", opts['log']
        path = type["local-log"] % (rev, short_hash)
        create_path(os.path.split(path)[0])
        f = open(path, 'w')
        store_stdout = sys.stdout
        sys.stdout = f
        mercurial.commands.log\
        (
            ui, repo, 
            rev=[opts['log']], 
            copies=None, 
            date='', 
            no_merges=None, 
            only_merges=None,
            keyword=[],
            style="changelog",
            user=[]
        ) 
        sys.stdout.flush()
        sys.stdout.close()
        sys.stdout = store_stdout
    path = os.path.join(os.path.split(BUILD_CONFIG)[0], "BUILD_LOG")
    f = open(path, os.path.exists(path) and "a" or "w") 
    f.write(time.strftime("%d.%m.%y %H:%M", time.localtime()) + ': ' + log_entry + "; rev: " + revision)
    f.write("\n") # FWIW os.linesep should be editor linesep
    
    path = os.path.join(os.path.split(BUILD_CONFIG)[0], "BUILD_LOG_PICKLE")
    f = open(path, "wb")
    cPickle.dump(build_log, f)
    f.close()

    print "done"
    


cmdtable = \
{
  # cmd name function call
  "app-revision": \
  (
    app_revision,
    # see mercurial/fancyopts.py for all of the command
    # flag options.
    [],
    "sets mercurial_revision in ini.js"
  ),
  "build-app": \
  (
    run_build_script,
    # see mercurial/fancyopts.py for all of the command
    # flag options.
    [('l', 'log', '', 'log range'), 
    ('f', 'config-file', None, 'path to config file'),
    ('s', 'show-config-file', None, 'show config file'),
    ('o', 'command-log', None, 'show the log of the last used parameters'),
    ('i', 'log-history', None, 'show the log of the last created logs')],
    "make a build, a zip and a log file"
  )
}
