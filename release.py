#!/usr/bin/env python3
"""Local release preparation only. No network calls or signing credentials."""
import argparse
import hashlib
import html
import json
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit
from zipfile import ZipFile, ZIP_DEFLATED, BadZipFile

ROOT = Path(__file__).resolve().parent
ADDON_ID = 'ipage-quick-links@adele.local'
FILES = ('manifest.json', 'core.js', 'background.js', 'reader.js', 'content.js', 'LICENSE', 'NOTICE')

def write_json(path, data):
    path.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')

def configuration():
    c = json.loads((ROOT / 'release-config.json').read_text(encoding='utf-8'))
    base = c['base_url'].rstrip('/') + '/'
    u = urlsplit(base)
    host = (u.hostname or '').lower()
    if (u.scheme != 'https' or not host or u.username or u.password or u.query or u.fragment
        or host.endswith(('.example', '.invalid', '.localhost'))
        or host in ('example.com', 'example.org', 'example.net', 'localhost')
        or 'your-host' in host or re.search(r'[\s<>"\\]', base)):
        raise ValueError('Replace base_url in release-config.json with your real permanent HTTPS folder URL.')
    version = c['version']
    if not isinstance(version, str) or not re.fullmatch(r'\d+\.\d+\.\d+', version):
        raise ValueError('Use a numeric version such as 1.0.1 or 1.0.2.')
    if any(int(n) > 65535 for n in version.split('.')):
        raise ValueError('Version components must be <= 65535.')
    return base, version

def source_manifest():
    m = json.loads((ROOT / 'extension/manifest.json').read_text(encoding='utf-8'))
    if m['browser_specific_settings']['gecko']['id'] != ADDON_ID:
        raise ValueError('Keep the existing add-on ID. A different ID is a different add-on.')
    return m

def prepare():
    base, version = configuration()
    m = source_manifest()
    m['version'] = version
    m['browser_specific_settings']['gecko']['update_url'] = base + 'updates.json'
    write_json(ROOT / 'extension/manifest.json', m)
    build = ROOT / 'build'
    build.mkdir(exist_ok=True)
    destination = build / f'ipage-quick-links-{version}-UNSIGNED.zip'
    with ZipFile(destination, 'w', ZIP_DEFLATED) as z:
        for name in FILES:
            z.write(ROOT / 'extension' / name, name)
    print(f'Upload to Mozilla for self-distribution signing: {destination}')
    print('This ZIP is unsigned. Download Mozilla\'s signed XPI, then run finalize.')

def finalize(signed_file):
    base, version = configuration()
    expected = source_manifest()
    if expected['version'] != version or expected['browser_specific_settings']['gecko'].get('update_url') != base + 'updates.json':
        raise ValueError('Run prepare with this configuration, then have that build signed first.')
    signed_file = Path(signed_file).resolve()
    raw = signed_file.read_bytes()
    with ZipFile(signed_file) as z:
        names = z.namelist()
        if len(names) != len(set(names)):
            raise ValueError('Duplicate ZIP entries are not supported.')
        actual = json.loads(z.read('manifest.json'))
        if actual != expected:
            raise ValueError('Signed manifest differs from the prepared release; check version, ID, URL, and permissions.')
        for name in FILES[1:]:
            if z.read(name) != (ROOT / 'extension' / name).read_bytes():
                raise ValueError(f'Signed {name} differs from the prepared source. Sign the current build.')
        lower = {name.lower() for name in names}
        if not ({'meta-inf/mozilla.rsa', 'meta-inf/cose.sig'} & lower):
            raise ValueError('No Mozilla signature metadata found. Use the signed XPI downloaded from Mozilla.')
    # Signature-file presence is a sanity check, not cryptographic validation.
    # Firefox validates Mozilla's signature when installing the exact XPI.
    publish = ROOT / 'docs'
    publish.mkdir(exist_ok=True)
    filename = f'ipage-quick-links-{version}.xpi'
    destination = publish / filename
    if destination.exists() and destination.read_bytes() != raw:
        raise ValueError('This version already has a different XPI. Increase the version and sign a new release.')
    index = publish / 'updates.json'
    feed = json.loads(index.read_text(encoding='utf-8')) if index.exists() else {'addons': {}}
    updates = feed.setdefault('addons', {}).setdefault(ADDON_ID, {}).setdefault('updates', [])
    current_number = tuple(map(int, version.split('.')))
    for entry in updates:
        prior = entry['version']
        if not re.fullmatch(r'\d+\.\d+\.\d+', prior):
            raise ValueError('Existing feed has an unsupported version format; review it manually.')
        if tuple(map(int, prior.split('.'))) > current_number:
            raise ValueError('This release is older than an entry in the current feed.')
    digest = 'sha256:' + hashlib.sha256(raw).hexdigest()
    if any(e['version'] == version and e.get('update_hash') not in (None, digest) for e in updates):
        raise ValueError('The feed already identifies different bytes for this version.')
    asset_base = json.loads((ROOT / 'release-config.json').read_text(encoding='utf-8'))['release_base_url'].replace('{version}', version)
    if not asset_base.startswith('https://github.com/adelechase/ipage-quick-links/releases/download/v' + version + '/'):
        raise ValueError('Release asset URL does not match this repository/version.')
    entry = {'version': version, 'update_link': asset_base + filename, 'update_hash': digest,
             'applications': {'gecko': {'strict_min_version': expected['browser_specific_settings']['gecko']['strict_min_version']}}}
    updates[:] = [e for e in updates if e['version'] != version] + [entry]
    write_json(index, feed)
    (publish / 'index.html').write_text(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
        '<title>iPage Quick GR and NG</title><body><h1>iPage Quick GR and NG</h1>'
        f'<p><a href="{html.escape(asset_base + filename, quote=True)}">Install version {html.escape(version)} for Firefox</a></p>'
        '<p>Firefox 142 or newer. If downloaded instead of installed, open about:addons, use the gear menu, '
        'and choose Install Add-on From File.</p><p><a href="privacy.html">Privacy information</a></p></body></html>\n', encoding='utf-8')
    print(f'Prepared signed release and update feed in {publish}')
    print('Install this exact XPI in Firefox to verify its signature and behavior.')
    print('Upload the signed XPI as a GitHub release asset before publishing docs/ to Pages.')
    print('No files have been uploaded by this script.')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('prepare')
    final = sub.add_parser('finalize')
    final.add_argument('signed_xpi')
    args = parser.parse_args()
    try:
        if args.command == 'prepare':
            prepare()
        else:
            finalize(args.signed_xpi)
    except (OSError, ValueError, KeyError, BadZipFile) as error:
        print(f'Release not prepared: {error}', file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    sys.exit(main())
