let filename = "sequence"
let extension = ".🗿"

function enableNewSaving() {
    sexySaving = true
    $('#saveAsText').text("Save As")
    $('#saveBtn').show()
}

function disableNewSaving() {
    sexySaving = false
    $('#saveAsText').text("Save")
    $('#saveBtn').hide()
}

let sexySavingSupported = typeof window.showSaveFilePicker === "function" // very few browsers support this awesome api
let sexySaving = !settings.oldSaving && sexySavingSupported
if (!sexySaving) disableNewSaving()
else enableNewSaving()

$('#saveOptions').show()
if (sexySavingSupported) $('.requiresNewSaving').show()

// read placed sounds and create sequence file
function generateSequenceFile() {
    let startingTime = Date.now()
    console.log(`Exporting sequence... (${$('#sequence div').length} icons)`)
    let sequenceList = []
    let toAdd = ""
    $('#sequence div').each(function() {
        let x = $(this)
        if (x.attr('sound')) {
            let snd = x.attr('str')
            let pitch = x.attr('pitch')
            let foundSnd = soundList.find(x => x.id == snd)
            let soundID = foundSnd ? (foundSnd.emoji || foundSnd.id) : (snd || "_pause")
            toAdd = (pitch ? `${soundID}@${pitch}` : soundID)
        }
        else if (x.attr('action')) {
            let action = x.attr('action')
            let actionStr = "!" + action
            if (x.attr('advanced')) {
                actionStr += `@${x.attr("val1")},${x.attr("val2")}`
            }
            else if (x.attr('amount')) {
                let num = x.attr('num')
                actionStr += ("@" + Number(x.attr('amount')))
                actionStr += (num == "add" ? "@+" : num == "multiply" ? "@x" : "")
            }
            toAdd = (actionStr)
        }
        if (sequenceList.length && sequenceList[sequenceList.length - 1][0] == toAdd) sequenceList[sequenceList.length - 1][1]++
        else sequenceList.push([toAdd, 1])
    })
    let finalString = sequenceList.map(x => `${x[0]}${x[1] > 1 ? "=" + x[1] : ""}`).join("|")
    console.log(`Exporting took ${+((Date.now() - startingTime) / 1000).toFixed(2)}s`)
    return finalString
}

// upon clicking 'save as' (or just save for old browsers)
$('#downloadBtn').click(function() {
    let saveData = generateSequenceFile()
    if (!saveData.length) return
    let blob = new Blob([saveData], {type: 'text/txt;charset=UTF-8'});
    if (ctrlHeld && altHeld) return openSequencePreview(blob)
    return sexySaving ? modernSave(blob) : classicSave(blob)
})

// saving through <a> element, for browsers that don't support the new file reading stuff 
function classicSave(data) {
    let saveData = generateSequenceFile()
    if (!saveData.length) return
    let downloader = document.createElement('a');
    downloader.href = URL.createObjectURL(data)
    downloader.dataset.downloadurl = ['text/txt', downloader.download, downloader.href].join(':');
    downloader.style.display = "none"; downloader.download = filename + extension
    downloader.target = "_blank"; document.body.appendChild(downloader);
    downloader.click(); document.body.removeChild(downloader);
    setUnsavedChanges(false)
    $('#saveBtn').addClass('alreadySaved')
}

// saving through file api, for cool browsers
function modernSave(data) {
    window.showSaveFilePicker({suggestedName: filename + extension})
    .then(selectedFile => {
        selectedFile.createWritable().then(writable => {
            setSaveLocation(selectedFile)
            setUnsavedChanges(false)
            writable.write(data).then(() => writable.close()).catch(console.error)
        }).catch(console.error)
    }).catch(console.error)
}

// moai-ify the filename
function setFilename(name) {
    filename = name
    if (filename.endsWith(extension)) filename = filename.slice(0, extension.length * -1)
    $('#saveName').val(filename)
}

// set location for quick saving
let saveLocation = null
function setSaveLocation(file) {
    setFilename(file.name)
    saveLocation = file
}

// save to last opened/saved file
function quickSave() {
    if (!saveLocation || saveLocation.name != filename + extension) return $('#downloadBtn').trigger('click') // save as
    let saveData = generateSequenceFile()
    if (!saveData.length) return
    if (ctrlHeld && altHeld) return openSequencePreview(new Blob([saveData], {type: 'text/txt;charset=UTF-8'}))
    saveLocation.createWritable().then(async writable => {
        writable.write(saveData).then(() => {
            setUnsavedChanges(false)
            writable.close()
        }).catch((e) => alert(e))
    }).catch(() => {})
}

// open sequence preview in new tab
function openSequencePreview(blob) {
    let blobURL = URL.createObjectURL(blob)
    window.open(blobURL)
}

// on file input
let reader = new FileReader();
$("#loadFile").on('change', function() {
    let selectedFile = this.files[0]
    if (!selectedFile) return
    $('#sequence').html("")
    $('#loadFile').val("")
    reader.readAsText(selectedFile)
    reader.onload = (function(file) {
        loadSequence(file.target.result)
        saveLocation = null
        setFilename(selectedFile.name)
    });
})

// load/read/parse sequence file
function loadSequence(data) {
    let startingTime = Date.now()
    console.log(`Loading sequence... (size: ${+(data.length / 1000).toFixed(2)} KB)`)
    try { 
        let sequenceData = "";
        (data || "").replace(/\s/g, "").split("|").forEach(x => {
            let [data, count] = x.split("=")
            let [main, pitch, num] = data.split("@")
            if (!main || !data) return
            let isAction = main.startsWith("!")
            let element = null
            if (isAction) {
                main = main.slice(1) // remove !
                element = $(`.action[action=${main}]`).first().clone()
                if (!element.length) return
                let actionData = actions.find(x => x.name == main)
                if (actionData.twoValues) {
                    if (!element.find("p").length) element.append("<p></p>")
                    for (let i=0; i<(count || 1); i++) sequenceData += addAdvancedAction(actionData.name, pitch.split(","), element, true).prop('outerHTML')
                    return    
                }
                else if (actionData.amount || actionData.isTarget) {
                    if (actionData.isTarget && !pitch) pitch = 1 
                    if (!element.find("p").length) element.append("<p></p>")
                    if (num == "x") num = "multiply"
                    else if (num == "+") num = "add"
                    for (let i=0; i<(count || 1); i++) sequenceData += addAction(main, +pitch, num, element, true).prop('outerHTML');
                    return
                }
            }
            else {
                let foundSound = soundList.find(x => x.id == main || x.emoji == main)
                element = $(`.sound[str=${foundSound ? foundSound.id : "_pause"}]`).first().clone()
                if (foundSound && Number(pitch)) {
                    element.attr('pitch', pitch)
                    element.append(`<p>${pitch > 0 ? "+" : ""}${pitch}</p>`)
                }
                element.removeAttr("soundorigin")
                element.removeAttr("soundname")
            }
            if (element) for (let i=0; i<(count || 1); i++) sequenceData += (element[0].outerHTML)
        })
        $('#sequence')[0].innerHTML = sequenceData
        deselectSection()
        syncSections()
        fetchRequiredSounds()
        setUnsavedChanges(false)
        console.log(`Loading took ${+((Date.now() - startingTime) / 1000).toFixed(2)}s`)
    }
    catch(e) { alert("That file couldn't be loaded!"); console.warn(e) }
}

// remove unsafe filename characters
function safeFilename(str) { return str.replace(/[/\\:*?"<>|]/g, "") }

$('#saveName').on('input keydown keyup blur', function() {
    let safeName = safeFilename($(this).val())
    filename = safeName || "sequence"
    $(this).val(safeName)
})

function setUnsavedChanges(unsaved) {
    unsavedChanges = !!unsaved
    if (unsavedChanges) $('#saveBtn').removeClass('alreadySaved')
    else $('#saveBtn').addClass('alreadySaved')
}

// exit confirmation
let unsavedChanges = false
$('#sequence').on('DOMSubtreeModified', function() { setUnsavedChanges(true) });
window.onbeforeunload = function(e) {
    if (unsavedChanges && $('#sequence').children().length && settings.exitConfirmation) {
        e.returnValue = "🗿";
        return cancel()
    }
};