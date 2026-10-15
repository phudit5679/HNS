/**
 * ที่เก็บรูปหลักฐานของแบบฟอร์มตรวจสอบคุณภาพร้าน Café Amazon บน Google Drive
 *
 * วิธีติดตั้งดูที่ apps-script/README.md
 * โครงสร้างโฟลเดอร์:
 *   โฟลเดอร์หลัก / 2569-10 ต.ค. / S001 สาขาบางนา 15-10-2569 / 1.13.jpg
 * ไฟล์รูปตั้งชื่อตามเลขข้อในแบบฟอร์ม
 */

// ====== ตั้งค่า (แก้ 2 บรรทัดนี้) ======
const FOLDER_ID = 'วาง_ID_โฟลเดอร์_Google_Drive_ที่นี่';
const TOKEN = 'ตั้งรหัสลับ_ให้ตรงกับ_IMAGE_SCRIPT_TOKEN_ในเว็บ';

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.token !== TOKEN) return reply({ ok: false, error: 'รหัสลับไม่ถูกต้อง' });
    if (!/^[A-Za-z0-9_-]+$/.test(req.auditId || '')) return reply({ ok: false, error: 'auditId ไม่ถูกต้อง' });

    const root = DriveApp.getFolderById(FOLDER_ID);
    if (req.action === 'prepare') return reply(prepareFolder(root, req));
    if (req.action === 'upload') return reply(uploadImage(req));
    if (req.action === 'save') return reply(saveImages(root, req));
    if (req.action === 'load') return reply(loadImages(root, req));
    if (req.action === 'delete') return reply(deleteImages(root, req));
    return reply({ ok: false, error: 'ไม่รู้จักคำสั่ง ' + req.action });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// หาโฟลเดอร์ของผลการตรวจ: ใช้ ID ที่เว็บจำไว้ก่อน
// ถ้าไม่มี (ข้อมูลที่บันทึกก่อนเปลี่ยนชื่อเป็นภาษาไทย) ค่อยหาจากชื่อที่เป็นรหัสเอกสาร
function findAuditFolder(root, req) {
  if (req.folderId) {
    try {
      const folder = DriveApp.getFolderById(req.folderId);
      if (!folder.isTrashed()) return folder;
    } catch (err) {}
  }
  const folders = root.getFoldersByName(req.auditId);
  return folders.hasNext() ? folders.next() : null;
}

function getOrCreateFolder(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

// ขั้นที่ 1: เตรียมโฟลเดอร์ (สร้างใหม่ หรือใช้ของเดิมแล้วล้างรูปเก่า)
// แยกขั้นตอนเพื่อให้เว็บส่งรูปหลายรูปพร้อมกันในขั้นที่ 2 ได้ เร็วกว่าส่งทีละรูป
function prepareFolder(root, req) {
  const folderName = String(req.folderName || req.auditId).slice(0, 200);
  const parent = req.monthFolderName ? getOrCreateFolder(root, String(req.monthFolderName).slice(0, 100)) : root;

  let folder = findAuditFolder(root, req);
  if (folder) {
    folder.setName(folderName);
    folder.moveTo(parent);
    const oldFiles = folder.getFiles();
    while (oldFiles.hasNext()) oldFiles.next().setTrashed(true);
  } else {
    folder = parent.createFolder(folderName);
  }
  return { ok: true, folderId: folder.getId() };
}

// ขั้นที่ 2: บันทึกรูป 1 รูปลงโฟลเดอร์ที่เตรียมไว้
function uploadImage(req) {
  const match = String(req.data || '').match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) return { ok: false, error: 'ข้อมูลรูปไม่ถูกต้อง' };
  const folder = DriveApp.getFolderById(req.folderId);
  folder.createFile(Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], String(req.itemId) + '.jpg'));
  return { ok: true };
}

// แบบเดิม (ส่งรูปทั้งหมดในคำสั่งเดียว) เก็บไว้เผื่อเว็บรุ่นเก่ายังเรียกใช้
function saveImages(root, req) {
  const folderName = String(req.folderName || req.auditId).slice(0, 200);
  const parent = req.monthFolderName ? getOrCreateFolder(root, String(req.monthFolderName).slice(0, 100)) : root;

  let folder = findAuditFolder(root, req);
  if (folder) {
    folder.setName(folderName);
    folder.moveTo(parent);
    const oldFiles = folder.getFiles();
    while (oldFiles.hasNext()) oldFiles.next().setTrashed(true);
  } else {
    folder = parent.createFolder(folderName);
  }

  const images = req.images || {};
  let count = 0;
  Object.keys(images).forEach(function (itemId) {
    const match = String(images[itemId]).match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!match) return;
    folder.createFile(Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], itemId + '.jpg'));
    count++;
  });
  return { ok: true, count: count, folderId: folder.getId() };
}

function loadImages(root, req) {
  const folder = findAuditFolder(root, req);
  const images = {};
  if (folder) {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const blob = file.getBlob();
      images[file.getName().replace(/\.jpg$/, '')] = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    }
  }
  return { ok: true, images: images };
}

function deleteImages(root, req) {
  const folder = findAuditFolder(root, req);
  if (folder) folder.setTrashed(true);
  return { ok: true };
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
