const path = require('path')
const fs = require('fs')
const ResEdit = require('resedit')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const info = context.packager.appInfo
  const exe = path.join(context.appOutDir, `${info.productFilename}.exe`)
  const data = fs.readFileSync(exe)
  const pe = ResEdit.NtExecutable.from(data, { ignoreCert: true })
  const res = ResEdit.NtExecutableResource.from(pe)
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.ico')))
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries)
  const groupId = groups.length ? groups[0].id : 1
  const lang = groups.length ? groups[0].lang : 1033
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, ico.icons.map(i => i.data))
  const versions = ResEdit.Resource.VersionInfo.fromEntries(res.entries)
  const v = versions[0]
  if (v) {
    const parts = info.version.split('.').map(Number)
    v.setFileVersion(parts[0], parts[1] || 0, parts[2] || 0, 0, 1033)
    v.setProductVersion(parts[0], parts[1] || 0, parts[2] || 0, 0, 1033)
    v.setStringValues({ lang: 1033, codepage: 1200 }, {
      FileDescription: info.productName,
      ProductName: info.productName,
      CompanyName: 'Gayathri Multi Speciality Clinic',
      LegalCopyright: '© Gayathri Multi Speciality Clinic',
      OriginalFilename: `${info.productFilename}.exe`,
      InternalName: info.productName
    })
    v.outputToResourceEntries(res.entries)
  }
  res.outputResource(pe)
  fs.writeFileSync(exe, Buffer.from(pe.generate()))
}
