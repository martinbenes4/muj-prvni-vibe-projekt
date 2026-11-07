# Bezpečnostní audit webové aplikace

Tento dokument je postup pro audit jednoduché webové aplikace (HTML, Vanilla JS, Tailwind CSS přes CDN, data v `localStorage`). Audit je statická kontrola kódu a chování v prohlížeči. Neprováděj útoky proti cizím systémům a nehledej způsob, jak zranitelnost zneužít mimo tuto aplikaci.

## Rozsah

- `index.html`
- `style.css`
- `app.js`
- další soubory, které se načítají do stránky (CDN, fonty, obrázky)

## OWASP

Projdi rizika z OWASP Top 10, která dávají smysl u čistě klientské aplikace bez vlastního serveru:

| Riziko | Co zkontrolovat |
| --- | --- |
| Injection / XSS | Uživatelský text se nikde neskládá do HTML jako řetězec. |
| Citlivá data | V kódu ani v úložišti nejsou hesla, tokeny ani API klíče. |
| Bezpečná konfigurace | CDN skripty mají jasný zdroj. Stránka nevyžaduje zbytečná oprávnění prohlížeče. |
| Zastaralé komponenty | Externí knihovny jsou načtené z důvěryhodného CDN a není jich víc, než aplikace potřebuje. |
| Selhání kontroly vstupu | Prázdný, příliš dlouhý a zvláštní vstup (úhlové závorky, uvozovky) aplikaci nerozbije a nezobrazí se jako kód. |
| Integrita dat | Data z `localStorage` se před použitím ověří. Poškozený JSON aplikaci neshodí. |

Ostatní body OWASP (řízení přístupu na serveru, SSRF, nezabezpečený design backendu) uveď jen tehdy, když v projektu skutečně existuje server nebo API. Jinak je označ jako mimo rozsah.

## Úniky API klíčů a hesel

- Prohledej celý projekt včetně HTML, JS, CSS a dokumentace na řetězce jako `api_key`, `apikey`, `secret`, `password`, `token`, `Bearer` a privátní klíče.
- Klíč v URL skriptu, v komentáři nebo v `localStorage` se počítá jako nález.
- Veřejný CDN odkaz bez tajného parametru (například Tailwind z `cdn.tailwindcss.com`) není únik klíče.
- Hesla se do této aplikace neukládají. Pokud by se v kódu objevilo pole pro heslo, nesmí putovat do `localStorage` v čitelné podobě.

## Sanitizace vstupů a XSS

- Uživatelský text (název návyku a jakýkoli další vstup) vkládej přes `textContent` nebo jinou DOM metodu, která text neparsuje jako HTML.
- `innerHTML`, `outerHTML`, `insertAdjacentHTML` a `document.write` nesmí dostat data od uživatele ani z `localStorage`.
- Atributy sestavené z uživatelského textu (`onclick`, `href`, `src`) jsou stejně rizikové jako HTML řetězec.
- Ověř v prohlížeči vstup typu `<img src=x onerror=alert(1)>`. Musí se zobrazit jako obyčejný text, ne jako spuštěný kód.
- `eval`, `new Function` a vkládání kódu z řetězce v aplikaci nemají být.

## localStorage

- Ukládej jen data, která aplikace potřebuje k zobrazení (identifikátor, název, dny splnění). Žádná hesla, tokeny ani cizí osobní údaje.
- Klíč úložiště je pevný a patří jen této aplikaci.
- Při čtení počítej s chybějícími, poškozenými nebo ručně upravenými daty: `JSON.parse` patří do `try/catch`, výsledek musí být pole očekávaného tvaru.
- Záznam bez platného `id` a textového `name` se nemá vykreslit.
- Smazání návyku musí zmizet i z úložiště, ne jen z obrazovky.
- Data v `localStorage` může číst každý skript na stejné origině. Proto na stránku nepatří cizí skript, který k tomu nemá důvod.

## Externí skripty přes CDN

- Každý `<script src>` a `<link href>` mimo vlastní soubory vypiš: adresa, k čemu slouží a jestli je nutný.
- Povolený je jen důvěryhodný zdroj, který aplikace opravdu používá. Neznámé domény, zkrácené URL a skripty vkládané až za běhu jsou nález.
- Zkontroluj, že CDN skript nejde přepsat uživatelským vstupem (adresa není složená z hodnoty formuláře nebo z `localStorage`).
- Tam, kde to CDN nabízí, preferuj konkrétní verzi a atribut `integrity` (SRI). U Tailwindu přes CDN poznamenej, že oficiální runtime skript SRI běžně nepoužívá a při výpadku CDN se stránka má pořád dát otevřít jako HTML.
- Po načtení stránky ověř v nástrojích prohlížeče (záložka Síť), že se nestahují další skripty, které v HTML nejsou.

## Výstup auditu

Ke každému nálezu uveď soubor, místo v kódu, proč je to riziko a jak to opravit bez změny chování aplikace. Když je kontrola v pořádku, napiš to výslovně u dané položky. Na konci shrň, jestli aplikace v tomto rozsahu obstála.
