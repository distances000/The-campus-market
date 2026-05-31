import { h } from "vue";

function createIcon(symbol) {
    return {
        name: `Icon${symbol}`,
        render() {
            return h("span", { class: "compat-icon" }, symbol);
        }
    };
}

export const Plus = createIcon("+");
export const Shop = createIcon("店");
export const ChatDotRound = createIcon("聊");
export const Message = createIcon("信");
export const User = createIcon("人");
export const Search = createIcon("搜");
export const ArrowLeft = createIcon("←");
export const Pointer = createIcon("赞");
export const ChatLineSquare = createIcon("评");
export const Delete = createIcon("删");
export const Picture = createIcon("图");
export const Star = createIcon("★");
export const Goods = createIcon("货");
export const Edit = createIcon("编");
export const Lock = createIcon("锁");
export const Tickets = createIcon("单");
export const Medal = createIcon("奖");
export const ArrowRight = createIcon("→");
