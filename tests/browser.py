"""Real Chromium checks against the packaged app; serves static files only."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import shutil
import zipfile
import tempfile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'test-results'
ARTIFACTS.mkdir(exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
site_path = os.environ.get('TEST_BASE_PATH', '').strip('/')
if site_path and (len(Path(site_path).parts) != 1 or site_path in ['.', '..']):
    raise ValueError('TEST_BASE_PATH must be a single directory name')
site_directory = tempfile.TemporaryDirectory(prefix='knotscape-browser-')
if site_path:
    (Path(site_directory.name) / site_path).symlink_to(ROOT / 'dist', target_is_directory=True)
document_root = site_directory.name if site_path else str(ROOT / 'dist')
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=document_root))
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}' + ('/' + site_path if site_path else '')
chromium = os.environ.get('CHROMIUM') or shutil.which('chromium') or shutil.which('google-chrome')

def ready(page, determinant):
    expect(page.locator('#determinant-stat')).to_have_text(str(determinant), timeout=30000)

def point(page, x, y):
    # Map drawing coordinates through the live SVG viewBox (letterboxing included).
    return page.locator('#diagram').evaluate('''(svg,p)=>{const q=svg.createSVGPoint();q.x=p[0];q.y=p[1];const r=q.matrixTransform(svg.getScreenCTM());return {x:r.x,y:r.y}}''', [x,y])

def click_point(page,x,y):
    p=point(page,x,y);page.mouse.click(p['x'],p['y'])

try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1440,'height':1100},accept_downloads=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(url+'/');ready(page,5)
  expect(page.locator('#analysis-content')).to_contain_text('HOMFLY-PT')
  page.locator('[data-analysis="boundary-slopes"]').click()
  expect(page.locator('#analysis-content')).to_contain_text('-4, 0, 4')
  expect(page.locator('#analysis-content')).to_contain_text('K(2/5)')
  page.locator('#analysis-content details summary').click()
  expect(page.locator('.slope-expansion')).to_have_count(3)
  page.locator('#slope-p').fill('1');page.locator('#slope-q').fill('3')
  page.get_by_role('button',name='Compute fraction',exact=True).click()
  expect(page.locator('.fraction-result')).to_contain_text('0, 6')
  page.locator('.fraction-result').get_by_role('button',name='Add slopes to notebook').click()
  expect(page.locator('#notebook')).to_contain_text('K(1/3)')
  page.locator('#slope-p').fill('-1');page.get_by_role('button',name='Compute fraction',exact=True).click()
  expect(page.locator('.fraction-result')).to_contain_text('-6, 0')
  with page.expect_download() as download:
   page.locator('.fraction-result').get_by_role('button',name='Download slopes (.json)').click()
  import json
  assert json.loads(Path(download.value.path()).read_text())['slopes']==[-6,0]
  page.locator('#slope-q').fill('4');page.get_by_role('button',name='Compute fraction',exact=True).click()
  expect(page.locator('.fraction-form [role="alert"]')).to_contain_text('two-component link')
  page.screenshot(path=str(ARTIFACTS/'boundary-slopes.png'),full_page=True)
  page.locator('[data-analysis="polynomials"]').click()
  page.screenshot(path=str(ARTIFACTS/'desktop.png'),full_page=True)
  page.locator('[data-analysis="symmetry"]').click()
  expect(page.locator('.symmetry-list details')).to_have_count(8)
  page.locator('.symmetry-list summary').nth(4).click()
  expect(page.locator('.symmetry-list')).to_contain_text('2 arcs')
  page.locator('[data-analysis="geometry"]').click()
  expect(page.locator('#analysis-content')).to_contain_text('2.0298832128')
  for view,kind in [('horoballs','circle'),('canonical','line'),('ford','line')]:
   page.locator(f'[data-view="{view}"]').click()
   expect(page.locator('#diagram '+kind).first).to_be_attached()
  page.locator('[data-view="canonical"]').click();page.locator('#labels-toggle').check()
  expect(page.locator('#diagram text').first).to_be_visible()
  page.locator('#export-format').select_option('postscript')
  with page.expect_download() as download: page.locator('#export-button').click()
  postscript=Path(download.value.path()).read_text();assert postscript.startswith('%!PS-Adobe') and 'NaN' not in postscript and 'lineto' in postscript
  page.locator('[data-view="diagram"]').click()
  page.locator('#dt-input').fill('4 6 javascript:2');page.locator('#load-code').click()
  expect(page.locator('#status')).to_have_class('status-bar error')
  page.locator('#dismiss-status').click();page.locator('#input-format').select_option('braid');page.locator('#dt-input').fill('aaa');page.locator('#load-code').click();ready(page,3)
  page.locator('[data-analysis="boundary-slopes"]').click()
  expect(page.locator('#analysis-content > .result-block')).to_contain_text('-6, 0')
  page.locator('#mirror-button').click()
  expect(page.locator('#analysis-content > .result-block')).to_contain_text('0, 6')
  page.locator('#mirror-button').click()
  page.locator('[data-analysis="polynomials"]').click();page.get_by_role('button',name='Compute Kauffman',exact=True).click()
  expect(page.locator('#analysis-content')).to_contain_text('−2a')
  page.locator('[data-analysis="group"]').click();expect(page.locator('#cycle-type')).to_be_visible()
  page.locator('#cover-homology').check();page.get_by_role('button',name='Find representations',exact=True).click()
  expect(page.locator('#notebook')).to_contain_text('S3')
  # Restore an original LinkSmith file, style it, cut/undo and submit it.
  page.locator('#file-input').set_input_files(str(ROOT/'tests/fixtures/trefoil.lsd'))
  expect(page.locator('#draw-tools')).to_be_visible()
  expect(page.locator('#diagram [data-crossing]')).to_have_count(3)
  page.locator('#draw-reverse').click();page.locator('#draw-alternate').click()
  page.locator('#draw-width').select_option('6')
  edge=page.locator('#diagram [data-edge="0:0"]');edge.evaluate("e=>e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:0,clientY:0}))")
  page.locator('#draw-cut').click();expect(page.locator('#draw-use')).to_be_disabled()
  page.locator('#draw-undo').click();expect(page.locator('#draw-use')).to_be_enabled()
  page.locator('#export-format').select_option('lsd')
  with page.expect_download() as download: page.locator('#export-button').click()
  saved=Path(download.value.path()).read_text();assert '\n0\n' in saved
  page.locator('#draw-use').click();ready(page,3)
  # Joining open arcs, closing, cutting and undo use the browser pointer flow.
  page.locator('[data-view="draw"]').click();page.locator('#draw-clear').click()
  for x,y in [(100,100),(300,100)]:click_point(page,x,y)
  page.locator('#draw-component').click()
  for x,y in [(300,300),(100,300)]:click_point(page,x,y)
  click_point(page,100,100)
  expect(page.locator('#draw-selection option')).to_have_count(1)
  page.locator('#draw-close').click();expect(page.locator('#draw-close')).to_be_disabled()
  page.locator('#draw-undo').click();expect(page.locator('#draw-close')).to_be_enabled()
  page.locator('#export-format').select_option('lsd')
  with page.expect_download() as download: page.locator('#export-button').click()
  assert '-1' in Path(download.value.path()).read_text()
  # Batch table range loading.
  page.locator('#crossings button').filter(has_text='8').click()
  page.locator('.range-picker summary').click();page.locator('#range-first').fill('1');page.locator('#range-last').fill('3');page.locator('#load-range').click()
  expect(page.locator('#batch-list button')).to_have_count(3)
  # Static site service worker: cache, disconnect, reload and select a new table.
  page.locator('#help-button').click();page.locator('#offline-button').click()
  expect(page.locator('#offline-state')).to_contain_text('All files are cached',timeout=60000)
  page.locator('#close-help').click();expect(page.locator('#determinant-stat')).not_to_have_text('—');before=page.locator('#determinant-stat').inner_text();context.set_offline(True);page.reload();ready(page,before)
  context.set_offline(False)
  assert not errors, errors
  context.close()
  print('PASS desktop calculations, editor, exports and service-worker offline reload',flush=True)
  # Standalone: only the initial document may use HTTP; all later computation is local.
  context=browser.new_context(viewport={'width':1440,'height':1100},accept_downloads=True)
  page=context.new_page();requests=[];page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(url+'/knotscape.html');ready(page,5);context.set_offline(True)
  page.locator('#crossings button').get_by_text('3',exact=True).click();page.locator('#knot-list button[data-name="3a1"]').click();ready(page,3)
  page.locator('[data-analysis="geometry"]').click();expect(page.locator('#analysis-content')).to_contain_text('No geometric solution')
  page.locator('[data-analysis="boundary-slopes"]').click()
  expect(page.locator('#analysis-content > .result-block')).to_contain_text('-6, 0')
  page.locator('#slope-p').fill('3');page.locator('#slope-q').fill('11')
  page.get_by_role('button',name='Compute fraction',exact=True).click()
  expect(page.locator('.fraction-result')).to_contain_text('-4, 0, 2, 8')
  page.locator('#help-button').click()
  with page.expect_download() as download:page.get_by_role('link',name='Download source code and licenses').click()
  with zipfile.ZipFile(download.value.path()) as archive:assert 'Knotscape/native/hyperbolic.c' in archive.namelist() and 'Knotscape/vendor/snappy/COPYING' in archive.namelist()
  assert [r for r in requests if r.startswith('http')]==[url+'/knotscape.html'],requests
  assert not errors,errors
  context.close();print('PASS standalone offline calculations and embedded corresponding source',flush=True)
  context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  page=context.new_page();page.goto(url+'/');ready(page,5)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Mobile horizontal overflow'
  page.screenshot(path=str(ARTIFACTS/'mobile.png'),full_page=True)
  page.locator('[data-analysis="boundary-slopes"]').click()
  expect(page.locator('#analysis-content')).to_contain_text('-4, 0, 4')
  page.locator('#slope-p').fill('1');page.locator('#slope-q').fill('5')
  page.get_by_role('button',name='Compute fraction',exact=True).click()
  expect(page.locator('.fraction-result')).to_contain_text('0, 10')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Slopes mobile horizontal overflow'
  page.screenshot(path=str(ARTIFACTS/'mobile-slopes.png'),full_page=True)
  page.locator('[data-view="draw"]').click();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Editor horizontal overflow'
  page.screenshot(path=str(ARTIFACTS/'mobile-editor.png'),full_page=True)
  context.close();browser.close();print('PASS mobile layout',flush=True)
finally:
 server.shutdown();server.server_close()
 site_directory.cleanup()
