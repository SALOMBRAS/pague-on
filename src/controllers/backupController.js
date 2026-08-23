const backupService = require('../services/backupService');
const { sendSuccess } = require('../utils/responseHelper');

const filenameDate = () => new Date().toISOString().slice(0, 10);

async function exportBackup(req, res) {
  const backup = await backupService.createBackup(req.user.id);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pagueon-backup-${filenameDate()}.json"`);
  return res.status(200).send(JSON.stringify(backup, null, 2));
}
async function restoreBackup(req, res) { return sendSuccess(res, await backupService.restoreBackup(req.user.id, req.body.backup || req.body, req.body.mode || req.query.mode || 'MERGE'), 'Backup restaurado com sucesso.'); }
async function cloudStatus(req, res) { return sendSuccess(res, await backupService.cloudStatus(req.user.id)); }
async function saveCloudBackup(req, res) { return sendSuccess(res, await backupService.saveCloudBackup(req.user.id), 'Backup na nuvem concluído.'); }
async function restoreCloudBackup(req, res) { return sendSuccess(res, await backupService.restoreCloudBackup(req.user.id, req.params.id, req.body.mode || 'MERGE'), 'Backup na nuvem restaurado com sucesso.'); }

module.exports = { exportBackup, restoreBackup, cloudStatus, saveCloudBackup, restoreCloudBackup };
