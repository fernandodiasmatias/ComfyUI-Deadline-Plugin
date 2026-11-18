import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

async function pickWorkers(current) {
    const response = await api.fetchApi("/deadline/workers");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || response.statusText);

    const selected = new Set(current.split(",").map((s) => s.trim()).filter(Boolean));
    const names = [...new Set([...data.workers, ...selected])];

    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;background:#0008;z-index:10000;display:flex;align-items:center;justify-content:center";
        const box = document.createElement("div");
        box.style.cssText = "background:#222;color:#ddd;padding:16px;border-radius:8px;min-width:260px;max-height:80vh;display:flex;flex-direction:column;gap:8px;font-family:sans-serif";
        box.innerHTML = "<b>Deadline workers</b>";

        const list = document.createElement("div");
        list.style.cssText = "overflow:auto;display:flex;flex-direction:column;gap:4px";
        const checks = names.map((name) => {
            const label = document.createElement("label");
            const check = document.createElement("input");
            check.type = "checkbox";
            check.checked = selected.has(name);
            label.append(check, ` ${name}`);
            if (!data.workers.includes(name)) label.append(" (not on farm)");
            list.append(label);
            return [name, check];
        });

        const buttons = document.createElement("div");
        buttons.style.cssText = "display:flex;gap:8px;justify-content:flex-end";
        const close = (value) => { overlay.remove(); resolve(value); };
        for (const [text, handler] of [
            ["Clear", () => checks.forEach(([, c]) => (c.checked = false))],
            ["Cancel", () => close(null)],
            ["OK", () => close(checks.filter(([, c]) => c.checked).map(([n]) => n).join(","))],
        ]) {
            const button = document.createElement("button");
            button.textContent = text;
            button.onclick = handler;
            buttons.append(button);
        }

        box.append(list, buttons);
        overlay.append(box);
        document.body.append(overlay);
    });
}

app.registerExtension({
    name: "Deadline.WorkerPicker",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "DeadlineSubmit") return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated?.apply(this, arguments);
            const field = this.widgets.find((w) => w.name === "machine_list");
            const button = this.addWidget("button", "Select workers...", null, async () => {
                try {
                    const value = await pickWorkers(field.value || "");
                    if (value !== null) {
                        field.value = value;
                        app.graph.setDirtyCanvas(true, true);
                    }
                } catch (error) {
                    alert(`Could not list Deadline workers: ${error.message}`);
                }
            });
            button.serialize = false;
            return result;
        };
    },
});
