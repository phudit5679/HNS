/**
 * ที่เก็บรูปหลักฐานของแบบฟอร์มตรวจสอบคุณภาพร้าน Café Amazon บน Google Drive
 *
 * วิธีติดตั้งดูที่ apps-script/README.md
 * รูปของผลการตรวจแต่ละรายการจะอยู่ในโฟลเดอร์ย่อยชื่อเดียวกับรหัสเอกสารใน Firebase
 * ไฟล์รูปตั้งชื่อตามเลขข้อในแบบฟอร์ม เช่น 1.13.jpg
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
    if (req.action === 'save') return reply(saveImages(root, req.auditId, req.images || {}));
    if (req.action === 'load') return reply(loadImages(root, req.auditId));
    if (req.action === 'delete') return reply(deleteImages(root, req.auditId));
    return reply({ ok: false, error: 'ไม่รู้จักคำสั่ง ' + req.action });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function getAuditFolder(root, auditId, create) {
  const folders = root.getFoldersByName(auditId);
  if (folders.hasNext()) return folders.next();
  return create ? root.createFolder(auditId) : null;
}

// แทนที่รูปทั้งหมดของผลการตรวจนี้ด้วยชุดใหม่ (ใช้ได้ทั้งบันทึกใหม่และแก้ไข)
function saveImages(root, auditId, images) {
  const folder = getAuditFolder(root, auditId, true);
  const oldFiles = folder.getFiles();
  while (oldFiles.hasNext()) oldFiles.next().setTrashed(true);

  let count = 0;
  Object.keys(images).forEach(function (itemId) {
    const match = String(images[itemId]).match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!match) return;
    folder.createFile(Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], itemId + '.jpg'));
    count++;
  });
  return { ok: true, count: count };
}

function loadImages(root, auditId) {
  const folder = getAuditFolder(root, auditId, false);
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

function deleteImages(root, auditId) {
  const folder = getAuditFolder(root, auditId, false);
  if (folder) folder.setTrashed(true);
  return { ok: true };
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
