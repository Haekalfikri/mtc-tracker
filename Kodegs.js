const SECURITY_PIN = "6661";
const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1ghCLNrTNu7DskTJk8L32z67k9s4AMMfNcZfTAi-Sgi4/edit?usp=drivesdk";
const TIMEZONE = "GMT+08:00"; // WITA

function doGet() {
    return HtmlService.createTemplateFromFile('Index')
        .evaluate()
        .setTitle('MTC Productivity Tracker - English Academy by Ruangguru')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function verifyPin(pin) {
    return { success: pin === SECURITY_PIN };
}

// ==========================================
// DB & TIME HELPERS
// ==========================================
function getPersonalDbId() {
    var props = PropertiesService.getUserProperties();
    var dbId = props.getProperty('PERSONAL_SPREADSHEET_ID');
    if (!dbId) {
        var ss = SpreadsheetApp.create("MTC_Personal_DB");
        dbId = ss.getId();
        props.setProperty('PERSONAL_SPREADSHEET_ID', dbId);
    }
    return dbId;
}

function getISOWeekNumber(d) {
    var date = new Date(d.getTime());
    // Use GMT+8 for consistency
    var witaStr = Utilities.formatDate(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    var witaDate = new Date(witaStr.substring(0,4), parseInt(witaStr.substring(5,7))-1, witaStr.substring(8,10));
    witaDate.setHours(0, 0, 0, 0);
    witaDate.setDate(witaDate.getDate() + 3 - (witaDate.getDay() + 6) % 7);
    var week1 = new Date(witaDate.getFullYear(), 0, 4);
    return 1 + Math.round(((witaDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function formatJamTeks(val) {
    if (!val) return "";
    if (val instanceof Date) {
        var str = Utilities.formatDate(val, TIMEZONE, "HH:mm");
        return str;
    }
    var str = val.toString().trim();
    var match = str.match(/(\d{1,2}):(\d{2})/);
    if (match) {
        var hh = ("0" + match[1]).slice(-2);
        var mm = match[2];
        return hh + ":" + mm;
    }
    return str;
}

function formatTanggalIndo(dateObj) {
    var months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    var dStr = Utilities.formatDate(dateObj, TIMEZONE, "d M yyyy");
    var parts = dStr.split(" ");
    return parts[0] + " " + months[parseInt(parts[1])-1] + " " + parts[2];
}

function parseTanggalToDateObj(rawDate) {
    if (rawDate instanceof Date) return rawDate;
    if (typeof rawDate === 'string') {
        var indoMatch = rawDate.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
        if (indoMatch) {
            var mIndex = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].indexOf(indoMatch[2]);
            if (mIndex !== -1) {
                return new Date(parseInt(indoMatch[3]), mIndex, parseInt(indoMatch[1]));
            }
        }
        return new Date(rawDate);
    }
    return new Date();
}

// ==========================================
// TRACKER DASHBOARD & SAVE (Main DB)
// ==========================================
function getDashboardStats(selectedDateStr, clientPin) {
    if (clientPin !== SECURITY_PIN) throw new Error("Akses ditolak: PIN salah.");
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var sheet = ss.getSheetByName('Tracker');
    if (!sheet) throw new Error("Sheet 'Tracker' tidak ditemukan.");

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return { dailyHours: 0, weeklyWorkingHours: 0, weeklyTeachingHours: 0, todayLogs: [] };

    var data = sheet.getRange(3, 4, lastRow - 2, 13).getValues();
    var displayData = sheet.getRange(3, 4, lastRow - 2, 13).getDisplayValues();

    // Determine target date in WITA
    var targetDateObj;
    if (selectedDateStr) {
        var parts = selectedDateStr.split('-');
        targetDateObj = new Date(parts[0], parts[1]-1, parts[2]);
    } else {
        var nowWita = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd");
        var p = nowWita.split('-');
        targetDateObj = new Date(p[0], p[1]-1, p[2]);
    }

    var targetWeek = "Week " + getISOWeekNumber(targetDateObj);
    var targetDateStr = Utilities.formatDate(targetDateObj, TIMEZONE, 'yyyy-MM-dd');

    var dailyHours = 0, weeklyWorkingHours = 0, weeklyTeachingHours = 0, todayLogs = [];

    for (var i = 0; i < data.length; i++) {
        var rawDate = data[i][0];
        if (!rawDate || rawDate === "") continue;

        var rowDateObj = parseTanggalToDateObj(rawDate);
        var rowDateStr = Utilities.formatDate(rowDateObj, TIMEZONE, 'yyyy-MM-dd');
        var rowWeek = data[i][1] || ("Week " + getISOWeekNumber(rowDateObj));

        var duration = parseFloat(data[i][4]) || 0;
        var sTimeStr = formatJamTeks(displayData[i][2]) || formatJamTeks(data[i][2]);
        var eTimeStr = formatJamTeks(displayData[i][3]) || formatJamTeks(data[i][3]);

        if (duration === 0 && sTimeStr && eTimeStr) {
            try {
                var startT = new Date("1970-01-01T" + sTimeStr);
                var endT = new Date("1970-01-01T" + eTimeStr);
                duration = Math.max(0, (endT - startT) / (1000 * 60 * 60));
            } catch (e) { }
        }

        var taskType = (data[i][8] || "").toString().trim();
        var rowIndex = i + 3;

        if (rowWeek === targetWeek) {
            weeklyWorkingHours += duration;
            if (taskType.toLowerCase() === 'teaching') weeklyTeachingHours += duration;
        }

        if (rowDateStr === targetDateStr) {
            dailyHours += duration;
            todayLogs.push({
                rowIndex: rowIndex,
                time: sTimeStr + " - " + eTimeStr,
                product: data[i][5] || "",
                category: data[i][6] || "",
                level: data[i][7] || "",
                taskType: taskType,
                taskDesc: data[i][9] || "",
                duration: duration.toFixed(1)
            });
        }
    }

    return {
        dailyHours: Math.round(dailyHours * 10) / 10,
        weeklyWorkingHours: Math.round(weeklyWorkingHours * 10) / 10,
        weeklyTeachingHours: Math.round(weeklyTeachingHours * 10) / 10,
        todayLogs: todayLogs.reverse(),
        spreadsheetName: ss.getName()
    };
}

function simpanDataTracker(entries, clientPin) {
    if (clientPin !== SECURITY_PIN) return { status: 'error', message: 'PIN salah!' };
    try {
        var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
        var sheet = ss.getSheetByName('Tracker');

        // Cari baris kosong pertama di Kolom D (Tanggal) agar tidak menimpa jika ada rumus yang ditarik jauh ke bawah
        var dates = sheet.getRange("D3:D").getValues();
        var targetRow = dates.length + 3;
        for (var i = 0; i < dates.length; i++) {
            if (!dates[i][0] || dates[i][0] === "") {
                targetRow = i + 3;
                break;
            }
        }

        // Muat data lama untuk pengecekan bentrok
        var existingData = [];
        var lastRowForOverlap = sheet.getLastRow();
        if (lastRowForOverlap >= 3) {
            // Ambil dari D3 sampai M (kolom 4 sampai 13)
            existingData = sheet.getRange(3, 4, lastRowForOverlap - 2, 10).getValues(); 
        }

        function timeToMins(tStr) {
            if (!tStr) return 0;
            var match = formatJamTeks(tStr).match(/(\d{1,2}):(\d{2})/);
            if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
            return 0;
        }

        var rowsToAdd = [];
        var conflictErrors = [];

        for (var j = 0; j < entries.length; j++) {
            var d = entries[j];
            var dateParts = d.date.split('-');
            var dObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            var tglIndo = formatTanggalIndo(dObj);
            
            var newStartMins = timeToMins(d.startTime);
            var newEndMins = timeToMins(d.endTime);

            // 1. Cek bentrok dengan data lama di sheet
            for (var k = 0; k < existingData.length; k++) {
                var extRow = existingData[k];
                var extTglIndo = extRow[0]; // Kolom D
                if (extTglIndo === tglIndo) {
                    var extStartMins = timeToMins(extRow[2]); // Kolom F
                    var extEndMins = timeToMins(extRow[3]);   // Kolom G
                    if (extStartMins > 0 && extEndMins > 0 && newStartMins > 0 && newEndMins > 0) {
                        if (Math.max(extStartMins, newStartMins) < Math.min(extEndMins, newEndMins)) {
                            conflictErrors.push("Bentrok tgl " + tglIndo + " (" + d.startTime + "-" + d.endTime + ") dengan: " + extRow[9]);
                        }
                    }
                }
            }

            // 2. Cek bentrok antar-jadwal baru (misal saat bulk insert rutin)
            for (var x = 0; x < j; x++) {
                var prevE = entries[x];
                if (prevE.date === d.date) {
                    var prevStartMins = timeToMins(prevE.startTime);
                    var prevEndMins = timeToMins(prevE.endTime);
                    if (Math.max(prevStartMins, newStartMins) < Math.min(prevEndMins, newEndMins)) {
                        conflictErrors.push("Bentrok antar-jadwal baru tgl " + tglIndo + " (" + d.startTime + "-" + d.endTime + ") dengan: " + prevE.taskDesc);
                    }
                }
            }

            rowsToAdd.push([
                tglIndo, // Col D (4)
                "", // Col E (5)
                d.startTime, // Col F (6)
                d.endTime, // Col G (7)
                "", // Col H (8)
                d.product, // Col I (9)
                d.category, // Col J (10)
                d.level || "", // Col K (11)
                d.taskType, // Col L (12)
                d.taskDesc, // Col M (13)
                d.evidence || "", // Col N (14)
                d.status || "Done", // Col O (15)
                d.notes || "" // Col P (16)
            ]);
        }

        // Jika ada bentrok, BATALKAN SEMUA dan lemparkan error
        if (conflictErrors.length > 0) {
            // Unikkan pesan error agar tidak terlalu panjang jika ada double check
            var uniqueErrors = [...new Set(conflictErrors)];
            throw new Error("Ditemukan jadwal bentrok:\n- " + uniqueErrors.join("\n- "));
        }

        var newLastDataRow = targetRow + rowsToAdd.length - 1;

        if (newLastDataRow >= 3) {
            // 1. Copy formula (jika ada) dari baris sebelumnya ke baris-baris baru
            if (targetRow > 3) {
                var formulasRange = sheet.getRange(targetRow - 1, 1, 1, sheet.getLastColumn());
                formulasRange.copyTo(sheet.getRange(targetRow, 1, rowsToAdd.length, sheet.getLastColumn()), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
            }
        }

        // Tulis baris baru di posisi kosong pertama (Setelah copy formula, agar data statis yang ikut tercopy tertimpa oleh data baru)
        sheet.getRange(targetRow, 4, rowsToAdd.length, 13).setValues(rowsToAdd);

        if (newLastDataRow >= 3) {
            // 2. Buat timestamp Unix untuk pengurutan
            var allData = sheet.getRange(3, 4, newLastDataRow - 2, 3).getValues(); // D, E, F
            var timestamps = [];
            for (var i = 0; i < allData.length; i++) {
                var dStr = allData[i][0];
                var tStr = allData[i][2];
                if (!dStr) {
                    timestamps.push([9999999999999]); // Baris kosong ke bawah
                    continue;
                }
                var dObjItem = parseTanggalToDateObj(dStr);
                if (tStr) {
                    var tStrMatch = formatJamTeks(tStr).match(/(\d{1,2}):(\d{2})/);
                    if (tStrMatch) {
                        dObjItem.setHours(parseInt(tStrMatch[1]), parseInt(tStrMatch[2]), 0, 0);
                    }
                }
                timestamps.push([dObjItem.getTime()]);
            }

            // 3. Gunakan kolom ekstra/baru di ujung tabel agar tidak error "out of bounds"
            var lastCol = sheet.getLastColumn();
            sheet.insertColumnAfter(lastCol);
            var tempCol = lastCol + 1;
            
            // Tulis timestamp ke tempCol
            sheet.getRange(3, tempCol, timestamps.length, 1).setValues(timestamps);

            // 4. Sortir seluruh range (A3 sampai kolom temporer) secara ascending
            var fullRange = sheet.getRange(3, 1, newLastDataRow - 2, tempCol);
            fullRange.sort({column: tempCol, ascending: true});

            // 5. Hapus kolom temporer
            sheet.deleteColumn(tempCol);
        }

        return { status: 'success', message: entries.length + ' aktivitas berhasil disimpan & diurutkan sesuai jadwal!' };
    } catch (err) {
        return { status: 'error', message: err.toString() };
    }
}

function hapusBarisTracker(rowIndex, clientPin) {
    if (clientPin !== SECURITY_PIN) return { status: 'error', message: 'PIN salah!' };
    try {
        var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
        var sheet = ss.getSheetByName('Tracker');
        sheet.deleteRow(rowIndex);
        return { status: 'success', message: 'Sesi berhasil dihapus.' };
    } catch (err) {
        return { status: 'error', message: err.toString() };
    }
}

function editBarisTracker(rowIndex, d, clientPin) {
    if (clientPin !== SECURITY_PIN) return { status: 'error', message: 'PIN salah!' };
    try {
        var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
        var sheet = ss.getSheetByName('Tracker');
        
        var dateParts = d.date.split('-');
        var dObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        var tglIndo = formatTanggalIndo(dObj);

        var newRowData = [
            [tglIndo, "", d.startTime, d.endTime, "", d.product, d.category, d.level || "", d.taskType, d.taskDesc, d.evidence || "", d.status || "Done", d.notes || ""]
        ];

        // Replace range in row D to P
        sheet.getRange(rowIndex, 4, 1, 13).setValues(newRowData);
        
        return { status: 'success', message: 'Aktivitas berhasil diperbarui!' };
    } catch (err) {
        return { status: 'error', message: err.toString() };
    }
}

// =======================================================
// CRUD TEMPLATE JADWAL RUTIN (Personal DB)
// =======================================================
function getOrCreateRutinSheet(ss) {
    var sheet = ss.getSheetByName('Config_Rutin');
    if (!sheet) {
        sheet = ss.insertSheet('Config_Rutin');
        sheet.appendRow(["ID", "LabelHari", "Judul", "StartTime", "EndTime", "Product", "Category", "Level", "TaskType", "TaskDesc", "DayIndices"]);
        var defaults = [
            ["R1", "Senin, Selasa, Rabu, Kamis, Jumat", "Daily Coordination", "10:00", "12:00", "EAC", "Daily Coordination", "", "Coordination", "Coordination with SA and BM", "1,2,3,4,5"],
            ["R2", "Selasa, Kamis", "Main Class: Ranger B", "17:00", "18:30", "EAC", "Main Class", "Non Dasher", "Teaching", "Ranger B", "2,4"],
            ["R3", "Rabu", "Main Class: Runner B", "16:30", "18:00", "EAC", "Main Class", "Non Dasher", "Teaching", "Runner B", "3"],
            ["R4", "Jumat", "Main Class: Runner B", "14:30", "16:00", "EAC", "Main Class", "Non Dasher", "Teaching", "Runner B", "5"]
        ];
        sheet.getRange(2, 4, defaults.length, 2).setNumberFormat('@');
        sheet.getRange(2, 1, defaults.length, 11).setValues(defaults);
    }
    return sheet;
}

function getJadwalRutin(clientPin) {
    if (clientPin !== SECURITY_PIN) throw new Error("Akses ditolak: PIN salah.");
    var ss = SpreadsheetApp.openById(getPersonalDbId());
    var sheet = getOrCreateRutinSheet(ss);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var displayData = sheet.getRange(2, 1, lastRow - 1, 11).getDisplayValues();
    var rawData = sheet.getRange(2, 1, lastRow - 1, 11).getValues();

    var list = [];
    for (var i = 0; i < displayData.length; i++) {
        if (!displayData[i][0]) continue;
        list.push({
            id: displayData[i][0].toString(), labelHari: displayData[i][1], judul: displayData[i][2],
            startTime: formatJamTeks(displayData[i][3]) || formatJamTeks(rawData[i][3]),
            endTime: formatJamTeks(displayData[i][4]) || formatJamTeks(rawData[i][4]),
            product: displayData[i][5], category: displayData[i][6], level: displayData[i][7],
            taskType: displayData[i][8], taskDesc: displayData[i][9],
            dayIndices: displayData[i][10] || ""
        });
    }
    return list;
}

function saveJadwalRutin(item, clientPin) {
    if (clientPin !== SECURITY_PIN) return { status: 'error', message: 'PIN salah!' };
    try {
        var ss = SpreadsheetApp.openById(getPersonalDbId());
        var sheet = getOrCreateRutinSheet(ss);
        var lastRow = sheet.getLastRow();
        var data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
        var targetRow = -1;
        if (item.id) {
            for (var i = 0; i < data.length; i++) {
                if (data[i][0].toString() === item.id.toString()) { targetRow = i + 2; break; }
            }
        }
        var rowValues = [
            item.id || ("R_" + new Date().getTime()), item.labelHari, item.judul, item.startTime, item.endTime,
            item.product, item.category, item.level || "", item.taskType, item.taskDesc, item.dayIndices || ""
        ];
        if (targetRow !== -1) {
            sheet.getRange(targetRow, 4, 1, 2).setNumberFormat('@');
            sheet.getRange(targetRow, 1, 1, 11).setValues([rowValues]);
            return { status: 'success', message: 'Template jadwal berhasil diperbarui!' };
        } else {
            var nextRow = sheet.getLastRow() + 1;
            sheet.getRange(nextRow, 4, 1, 2).setNumberFormat('@');
            sheet.getRange(nextRow, 1, 1, 11).setValues([rowValues]);
            return { status: 'success', message: 'Template jadwal baru ditambahkan!' };
        }
    } catch (err) { return { status: 'error', message: err.toString() }; }
}

function deleteJadwalRutin(id, clientPin) {
    if (clientPin !== SECURITY_PIN) return { status: 'error', message: 'PIN salah!' };
    try {
        var ss = SpreadsheetApp.openById(getPersonalDbId());
        var sheet = getOrCreateRutinSheet(ss);
        var lastRow = sheet.getLastRow();
        if (lastRow < 2) return { status: 'error', message: 'Tidak ada data.' };
        var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
            if (ids[i][0].toString() === id.toString()) {
                sheet.deleteRow(i + 2);
                return { status: 'success', message: 'Template berhasil dihapus!' };
            }
        }
        return { status: 'error', message: 'ID tidak ditemukan.' };
    } catch (err) { return { status: 'error', message: err.toString() }; }
}

// =======================================================
// CRUD HARI KOSONG (Personal DB)
// =======================================================
function getOrCreateDayoffSheet(ss) {
    var sheet = ss.getSheetByName('Config_Dayoff');
    if (!sheet) {
        sheet = ss.insertSheet('Config_Dayoff');
        sheet.appendRow(["ID", "Judul", "StartTime", "EndTime", "Product", "Category", "Level", "TaskType", "TaskDesc"]);
        var defaults = [
            ["D1", "Daily Coordination", "10:00", "12:00", "EAC", "Daily Coordination", "", "Coordination", "Coordination with SA and BM"],
            ["D2", "Material Creation EAC", "13:00", "15:00", "EAC", "Material Creation", "", "Planning", "Runner/Ranger"],
            ["D3", "Material Creation BAC", "15:00", "17:00", "BAC", "Material Creation", "", "Planning", "Bahasa Inggris"]
        ];
        sheet.getRange(2, 3, defaults.length, 2).setNumberFormat('@'); // format time
        sheet.getRange(2, 1, defaults.length, 9).setValues(defaults);
    }
    return sheet;
}

function getDayoffData(clientPin) {
    if (clientPin !== SECURITY_PIN) throw new Error("Akses ditolak: PIN salah.");
    var ss = SpreadsheetApp.openById(getPersonalDbId());
    var sheet = getOrCreateDayoffSheet(ss);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var displayData = sheet.getRange(2, 1, lastRow - 1, 9).getDisplayValues();
    var rawData = sheet.getRange(2, 1, lastRow - 1, 9).getValues();

    var list = [];
    for (var i = 0; i < displayData.length; i++) {
        if (!displayData[i][0]) continue;
        list.push({
            id: displayData[i][0].toString(), judul: displayData[i][1],
            startTime: formatJamTeks(displayData[i][2]) || formatJamTeks(rawData[i][2]),
            endTime: formatJamTeks(displayData[i][3]) || formatJamTeks(rawData[i][3]),
            product: displayData[i][4], category: displayData[i][5], level: displayData[i][6],
            taskType: displayData[i][7], taskDesc: displayData[i][8]
        });
    }
    return list;
}

function saveDayoffData(item, clientPin) {
    if (clientPin !== SECURITY_PIN) return { status: 'error', message: 'PIN salah!' };
    try {
        var ss = SpreadsheetApp.openById(getPersonalDbId());
        var sheet = getOrCreateDayoffSheet(ss);
        var lastRow = sheet.getLastRow();
        var data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
        var targetRow = -1;
        if (item.id) {
            for (var i = 0; i < data.length; i++) {
                if (data[i][0].toString() === item.id.toString()) { targetRow = i + 2; break; }
            }
        }
        var rowValues = [
            item.id || ("D_" + new Date().getTime()), item.judul, item.startTime, item.endTime,
            item.product, item.category, item.level || "", item.taskType, item.taskDesc
        ];
        if (targetRow !== -1) {
            sheet.getRange(targetRow, 3, 1, 2).setNumberFormat('@');
            sheet.getRange(targetRow, 1, 1, 9).setValues([rowValues]);
            return { status: 'success', message: 'Aktivitas berhasil diperbarui!' };
        } else {
            var nextRow = sheet.getLastRow() + 1;
            sheet.getRange(nextRow, 3, 1, 2).setNumberFormat('@');
            sheet.getRange(nextRow, 1, 1, 9).setValues([rowValues]);
            return { status: 'success', message: 'Aktivitas baru ditambahkan!' };
        }
    } catch (err) { return { status: 'error', message: err.toString() }; }
}

function deleteDayoffData(id, clientPin) {
    if (clientPin !== SECURITY_PIN) return { status: 'error', message: 'PIN salah!' };
    try {
        var ss = SpreadsheetApp.openById(getPersonalDbId());
        var sheet = getOrCreateDayoffSheet(ss);
        var lastRow = sheet.getLastRow();
        if (lastRow < 2) return { status: 'error', message: 'Data tidak ditemukan.' };
        var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < data.length; i++) {
            if (data[i][0].toString() === id.toString()) {
                sheet.deleteRow(i + 2);
                return { status: 'success', message: 'Aktivitas dihapus.' };
            }
        }
        return { status: 'error', message: 'Data tidak ditemukan.' };
    } catch (err) { return { status: 'error', message: err.toString() }; }
}

// =======================================================
// CRUD TASK DESC / KELAS (Personal DB)
// =======================================================
function getOrCreateKelasSheet(ss) {
    var sheet = ss.getSheetByName('Config_Kelas');
    if (!sheet) {
        sheet = ss.insertSheet('Config_Kelas');
        sheet.appendRow(["ID", "CategoryTitle", "LabelButton", "Product", "Level", "Category", "TaskType", "TaskDesc"]);
        var defaults = [
            ["K1", "English Academy (EAC)", "Ranger A", "EAC", "Non Dasher", "Main Class", "Teaching", "Ranger A"],
            ["K2", "English Academy (EAC)", "Ranger B", "EAC", "Non Dasher", "Main Class", "Teaching", "Ranger B"],
            ["K3", "English Academy (EAC)", "Runner A", "EAC", "Non Dasher", "Main Class", "Teaching", "Runner A"],
            ["K4", "Brain Academy (BAC) - SMP", "B. Inggris Kelas 7", "BAC", "", "Main Class", "Teaching", "Bahasa Inggris Kelas 7"],
            ["K5", "Brain Academy (BAC) - SMA", "B. Inggris Kelas 10", "BAC", "", "Main Class", "Teaching", "Bahasa Inggris Kelas 10"]
        ];
        sheet.getRange(2, 1, defaults.length, 8).setValues(defaults);
    }
    return sheet;
}

function getKelasConfig(clientPin) {
    if (clientPin !== SECURITY_PIN) throw new Error("Akses ditolak: PIN salah.");
    var ss = SpreadsheetApp.openById(getPersonalDbId());
    var sheet = getOrCreateKelasSheet(ss);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var data = sheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues();
    var list = [];
    for (var i = 0; i < data.length; i++) {
        if (!data[i][0]) continue;
        list.push({
            id: data[i][0], categoryTitle: data[i][1], labelButton: data[i][2],
            product: data[i][3], level: data[i][4], category: data[i][5],
            taskType: data[i][6], taskDesc: data[i][7]
        });
    }
    return list;
}

function saveKelas(item, clientPin) {
    if (clientPin !== SECURITY_PIN) return { status: 'error', message: 'PIN salah!' };
    try {
        var ss = SpreadsheetApp.openById(getPersonalDbId());
        var sheet = getOrCreateKelasSheet(ss);
        var lastRow = sheet.getLastRow();
        var data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
        var targetRow = -1;
        if (item.id) {
            for (var i = 0; i < data.length; i++) {
                if (data[i][0].toString() === item.id.toString()) { targetRow = i + 2; break; }
            }
        }
        var rowValues = [
            item.id || ("C_" + new Date().getTime()), item.categoryTitle, item.labelButton,
            item.product, item.level || "", item.category, item.taskType, item.taskDesc
        ];
        if (targetRow !== -1) {
            sheet.getRange(targetRow, 1, 1, 8).setValues([rowValues]);
            return { status: 'success', message: 'Kelas berhasil diperbarui!' };
        } else {
            var nextRow = sheet.getLastRow() + 1;
            sheet.getRange(nextRow, 1, 1, 8).setValues([rowValues]);
            return { status: 'success', message: 'Kelas baru ditambahkan!' };
        }
    } catch (err) { return { status: 'error', message: err.toString() }; }
}

function deleteKelas(id, clientPin) {
    if (clientPin !== SECURITY_PIN) return { status: 'error', message: 'PIN salah!' };
    try {
        var ss = SpreadsheetApp.openById(getPersonalDbId());
        var sheet = getOrCreateKelasSheet(ss);
        var lastRow = sheet.getLastRow();
        if (lastRow < 2) return { status: 'error', message: 'Tidak ada data.' };
        var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
            if (ids[i][0].toString() === id.toString()) {
                sheet.deleteRow(i + 2);
                return { status: 'success', message: 'Kelas dihapus!' };
            }
        }
        return { status: 'error', message: 'ID tidak ditemukan.' };
    } catch (err) { return { status: 'error', message: err.toString() }; }
}

// =======================================================
// DATABASE TRACKER (Full Data Fetch)
// =======================================================
function getAllTrackerData(clientPin) {
    if (clientPin !== SECURITY_PIN) throw new Error("Akses ditolak: PIN salah.");
    var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
    var sheet = ss.getSheetByName('Tracker');
    if (!sheet) throw new Error("Sheet Tracker tidak ditemukan.");

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return [];

    // Ambil Kolom D sampai P (Kolom 4 sampai 16 = 13 kolom) mulai dari baris 3
    var data = sheet.getRange(3, 4, lastRow - 2, 13).getDisplayValues();
    
    var result = [];
    for (var i = 0; i < data.length; i++) {
        var row = data[i];
        if (!row[0]) continue; // Skip jika tanggal kosong
        
        var dStr = row[0]; // e.g. "9 September 2026"
        var tStr = row[2]; // startTime
        
        var dObjItem = parseTanggalToDateObj(dStr);
        if (tStr) {
            var tStrMatch = formatJamTeks(tStr).match(/(\d{1,2}):(\d{2})/);
            if (tStrMatch) {
                dObjItem.setHours(parseInt(tStrMatch[1]), parseInt(tStrMatch[2]), 0, 0);
            }
        }
        
        // Kalkulasi durasi (desimal) untuk frontend progress bar
        var duration = 0;
        if (row[2] && row[3]) {
            var stMatch = formatJamTeks(row[2]).match(/(\d{1,2}):(\d{2})/);
            var etMatch = formatJamTeks(row[3]).match(/(\d{1,2}):(\d{2})/);
            if (stMatch && etMatch) {
                var sHour = parseInt(stMatch[1]) + parseInt(stMatch[2])/60;
                var eHour = parseInt(etMatch[1]) + parseInt(etMatch[2])/60;
                duration = eHour - sHour;
                if (duration < 0) duration += 24;
            }
        }

        // Format nama bulan secara aman dari Object Date
        var bulanIndoList = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        var monthIndex = dObjItem.getMonth();
        var monthName = isNaN(monthIndex) ? "" : bulanIndoList[monthIndex];

        result.push({
            date: row[0],
            month: monthName,
            unixTime: dObjItem.getTime(), // Sangat berguna untuk filter start/end date
            startTime: row[2],
            endTime: row[3],
            duration: Math.round(duration * 10) / 10,
            product: row[5],
            category: row[6],
            taskType: row[8],
            taskDesc: row[9],
            status: row[11],
            rowIndex: i + 3
        });
    }

    // Urutkan dari yang terbaru di atas (descending)
    result.sort(function(a, b) {
        return b.unixTime - a.unixTime;
    });

    return result;
}
