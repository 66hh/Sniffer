const fs = require("fs")
const axios = require("axios")
const readline = require("readline")
const { version } = require("./version")
const { loadCache, log, openUrl } = require("./utils")
const { checkSnapFastcall, copyToClipboard } = require("./generated/native")

const exportToSeelie = proto => {
    const out = { achievements: {} }
    proto.list.filter(a => a.status === 3 || a.status === 2).forEach(({id}) => {
        out.achievements[id === 81222 ? 81219 : id] = { done: true }
    })
    const fp = `./export-${Date.now()}-seelie.json`
    fs.writeFileSync(fp, JSON.stringify(out))
    log(`导出为文件: ${fp}`)
}

const exportToPaimon = async proto => {
    const out = { achievement: {} }
    const data = await loadCache()
    proto.list.filter(a => a.status === 3 || a.status === 2).forEach(({id}) => {
        const gid = data["a"][id]["g"]
        if (out.achievement[gid] === undefined) {
            out.achievement[gid] = {}
        }
        out.achievement[gid][id === 81222 ? 81219 : id] = true
    })
    const fp = `./export-${Date.now()}-paimon.json`
    fs.writeFileSync(fp, JSON.stringify(out))
    log(`导出为文件: ${fp}`)
}

const UIAF = proto => {
    const out = {
        info: {
            export_app: "YaeAchievement",
            export_timestamp: Date.now(),
            export_app_version: version.name,
            uiaf_version: "v1.0"
        },
        list: []
    }
    proto.list.filter(a => a.status === 3 || a.status === 2).forEach(({id, finishTimestamp, current}) => {
        out.list.push({
            id: id,
            timestamp: finishTimestamp,
            current: current
        })
    })
    return out
}

const exportToSnapGenshin = async proto => {
    if (checkSnapFastcall()) {
        const result = UIAF(proto)
        const json = JSON.stringify(result)
        copyToClipboard(json)
        openUrl(`snapgenshin://achievement/import/uiaf`)
        log("在 SnapGenshin 进行下一步操作")
    } else {
        log("请更新 SnapGenshin 后重试")
    }
}

const exportToCocogoat = async proto => {
    const result = UIAF(proto)
    const response = await axios.post(`https://77.cocogoat.work/v1/memo?source=${encodeURI("全部成就")}`, result).catch(_ => {
        console.log("网络错误，请检查网络后重试 (26-1)")
        process.exit(261)
    })
    if (response.status !== 201) {
        console.log(`API StatusCode 错误，请联系开发者以获取帮助 (26-2-${response.status})`)
        process.exit(262)
    }
    const retcode = openUrl(`https://cocogoat.work/achievement?memo=${response.data.key}`)
    if (retcode > 32) {
        log("在浏览器内进行下一步操作")
    } else {
        log(`打开此链接以进行下一步操作: https://cocogoat.work/achievement?memo=${response.data.key}`)
    }
}

const exportToCsv = async proto => {
    const data = await loadCache()
    const outputLines = ["ID,状态,特辑,名称,描述,当前进度,目标进度,完成时间"]
    const getStatusText = i => {
        switch (i) {
            case  1: return "未完成"
            case  2: return "已完成，未领取奖励"
            case  3: return "已完成"
            default: return "未知"
        }
    }
    const getTime = ts => {
        const d = new Date(parseInt(`${ts}000`))
        const p = i => i.toString().padStart(2, "0")
        return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    }
    const bl = [84517]
    proto.list.forEach(({current, finishTimestamp, id, status, require}) => {
        if (!bl.includes(id)) {
            const curAch = data["a"][id] === undefined ? (() => {
                console.log(`Error get id ${id} in excel`)
                return {
                    g: "未知",
                    n: "未知",
                    d: "未知"
                }
            })() : data["a"][id]
            outputLines.push(`${id},${getStatusText(status)},${data["g"][curAch.g]},${curAch.n},${curAch.d},${status !== 1 ? current === 0 ? require : current : current},${require},${status === 1 ? "" : getTime(finishTimestamp)}`)
        }
    })
    const fp = `./export-${Date.now()}.csv`
    fs.writeFileSync(fp, `\uFEFF${outputLines.join("\n")}`)
    log(`导出为文件: ${fp}`)
}

const exportData = async proto => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    const question = (query) => new Promise(resolve => {
        rl.question(query, resolve)
    })
    const chosen = await question(
        [
            "导出至: ",
            "[0] 椰羊 (https://cocogoat.work/achievement)",
            "[1] SnapGenshin",
            "[2] Paimon.moe",
            "[3] Seelie.me",
            "[4] 表格文件 (默认)",
            "输入一个数字(0-4): "
        ].join("\n")
    )
    rl.close()
    switch (chosen.trim()) {
        case "0":
            await exportToCocogoat(proto)
            break
        case "1":
            await exportToSnapGenshin(proto)
            break
        case "2":
            await exportToPaimon(proto)
            break
        case "3":
            await exportToSeelie(proto)
            break
        case "raw":
            fs.writeFileSync(`./export-${Date.now()}-raw.json`, JSON.stringify(proto,null,2))
            log("OK")
            break
        default:
            await exportToCsv(proto)
    }
}

module.exports = {
    exportData
}
