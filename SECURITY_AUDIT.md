# Bezpečnostní audit webové aplikace

Tento dokument je postup pro audit trackeru návyků. Aplikace běží v prohlížeči (HTML, Vanilla JS, Tailwind CSS přes CDN) a data drží v Supabase: přihlášení uživatelů a tabulka `habits`. Část stavu zůstává v `localStorage`.

Audit je statická kontrola kódu a chování v prohlížeči. U databáze a přihlášení kontroluj, jak k nim kód přistupuje a jaká pravidla projekt vyžaduje. Neprováděj útoky proti cizím systémům, nezakládej cizí účty a nečti ani neměň řádky jiných uživatelů.

## Rozsah

- `index.html`
- `style.css`
- `app.js`
- další soubory, které se načítají do stránky (CDN, fonty, obrázky)
- volání Supabase z prohlížeče: Auth a tabulka `habits`
- to, co aplikace vypisuje do konzole, do hlášek na stránce a do úložiště prohlížeče

Vlastní server v repozitáři není. Databáze a přihlášení jsou služba Supabase. SSRF a provoz vlastního backendu jsou mimo rozsah. Řízení přístupu k tabulce `habits` v rozsahu je.

## OWASP

| Riziko | Co zkontrolovat |
| --- | --- |
| Řízení přístupu | Bez přihlášení nejde s návyky pracovat. Každý požadavek na `habits` patří jen přihlášenému uživateli. Schování obrazovky v HTML není ochrana dat. |
| Injection / XSS | Uživatelský text se nikde neskládá do HTML jako řetězec. Hodnoty posílané do filtru databáze nejsou slepené z volného textu. |
| Citlivá data | V kódu, v logu ani v `localStorage` není heslo, `service_role` klíč, tajemství Google ani databázové heslo. Veřejný anon klíč v klientovi je očekávaný, ale nic víc. |
| Bezpečná konfigurace | CDN skripty mají jasný zdroj. Přihlášení přes Google i e-mail má povolené jen adresy návratu této aplikace. Stránka nevyžaduje zbytečná oprávnění prohlížeče. |
| Zastaralé komponenty | Externí knihovny jsou z důvěryhodného CDN, s konkrétní verzí tam, kde to CDN umožňuje, a není jich víc, než aplikace potřebuje. |
| Selhání kontroly vstupu | Prázdný, příliš dlouhý a zvláštní vstup (úhlové závorky, uvozovky, oddělovač času v názvu) aplikaci nerozbije a nezobrazí se jako kód. |
| Integrita dat | Data z `localStorage` i řádky z tabulky se před použitím ověří. Poškozený JSON nebo řádek bez platného data a názvu se nevykreslí. |
| Logování | Konzole, hlášky na stránce a uložené záznamy neobsahují heslo, přístupový token, celý klíč ani cizí osobní údaje. |

## Úniky klíčů a hesel

- Prohledej celý projekt včetně HTML, JS, CSS a dokumentace na `api_key`, `apikey`, `secret`, `password`, `token`, `Bearer`, `service_role` a privátní klíče.
- V klientovi smí být jen veřejný anon klíč Supabase a adresa projektu. Klíč role `service_role`, heslo k databázi a tajemství klienta Google (Client Secret) v repozitáři ani ve stránce být nesmí.
- Klíč v URL skriptu, v komentáři nebo zapsaný aplikací do `localStorage` se počítá jako nález. Session token, který si do `localStorage` ukládá knihovna Supabase, popiš jako známé chování a riziko při XSS, ne jako heslo uložené aplikací.
- Veřejný CDN odkaz bez tajného parametru (například Tailwind z `cdn.tailwindcss.com`) není únik klíče.
- Heslo z formuláře smí odejít jen do `signInWithPassword` nebo `signUp`. Nesmí se vypsat do konzole, do textu hlášky ani do `localStorage`.

## Přihlášení

- Bez session se tracker nezobrazí a `saveEvents` nic neodešle. Ověř, že odhlášení session zruší a data účtu z obrazovky zmizí.
- Přihlášení přes Google používá `signInWithOAuth` a návrat na adresu této stránky. Chyba vrácená v adrese se uživateli ukáže jako text, ne jako spuštěný kód.
- E-mail a heslo, i když jsou na stránce schované, se neukládají. Chybová hláška nerozlišuje existující účet od špatného hesla tam, kde by to šlo zneužít k zjišťování účtů. Hláška smí říct, že e-mail ještě není potvrzený.
- Po založení účtu bez session aplikace uživatele nepustí dál, dokud Supabase session nevydá.
- Zkontroluj v projektu Supabase, že je zapnutý jen poskytovatel, který stránka nabízí, a že mezi povolenými adresami návratu není cizí doména.

## Databáze

- Čtení, zápis i mazání tabulky `habits` jde jen přes přihlášeného klienta a filtr `user_id` je identifikátor ze session, ne hodnota z formuláře.
- V databázi musí platit pravidla řádků: `select`, `insert`, `update` a `delete` jen tam, kde `user_id` je `auth.uid()`. Bez těchto pravidel anon klíč z prohlížeče stačí ke čtení nebo přepisu cizích návyků. Pravidla v tomto repozitáři nejsou, proto je zapiš jako nález, dokud nejsou ověřená v projektu Supabase.
- `upsert` a mazání nesmí smazat řádky jiného uživatele. Seznam id ve filtru smí obsahovat jen identifikátory, které aplikace sama vytvořila (UUID), ne text z názvu události.
- Do tabulky se ukládá jen to, co k návyku patří: identifikátor, uživatel, název, datum, splnění a čas, pokud je součástí uloženého názvu. Žádné heslo ani token.
- Řádek z cloudu bez textového názvu nebo platného data se nezobrazí. Čas v názvu se před zobrazením oddělí a na stránku jde jen čistý název.
- Chyba databáze se na stránce projeví jako obecná česká hláška. Syrová odpověď služby, SQL ani klíč se uživateli neukazuje.

## Logování

- Prohledej `console.log`, `console.debug`, `console.info`, `console.warn`, `console.error` a každý text skládaný do hlášky na stránce.
- Nález je výpis hesla, přístupového nebo obnovovacího tokenu, anon klíče, celého objektu session, hlavičky `Authorization` nebo řádku tabulky s cizím `user_id`.
- Hláška smí říct, že načtení nebo uložení selhalo. Nemá opakovat interní kód služby, pokud k tomu uživatel nic neudělá.
- Do `localStorage` se jako log nesmí zapisovat průběh přihlášení ani tělo požadavku na databázi.

## Sanitizace vstupů a XSS

- Uživatelský text (název návyku, e-mail, hláška) vkládej přes `textContent` nebo jinou DOM metodu, která text neparsuje jako HTML.
- `innerHTML`, `outerHTML`, `insertAdjacentHTML` a `document.write` nesmí dostat data od uživatele, z `localStorage` ani z tabulky.
- Atributy sestavené z uživatelského textu (`onclick`, `href`, `src`) jsou stejně rizikové jako HTML řetězec. `aria-label` nastavený přes `setAttribute` je v pořádku.
- Ověř v prohlížeči vstup typu `<img src=x onerror=alert(1)>`. Musí se zobrazit jako obyčejný text, ne jako spuštěný kód. Stejně zkontroluj název, který v sobě má časový přípon `|HH:mm-HH:mm|`.
- `eval`, `new Function` a vkládání kódu z řetězce v aplikaci nemají být.

## localStorage

- Aplikace si sem smí uložit motiv a časy událostí. Seznam návyků bez přihlášení se odtud nenačítá ani neukládá.
- Heslo a ručně složený token se sem nezapisují. Session token knihovny Supabase popiš zvlášť u citlivých dat.
- Klíče úložiště jsou pevné a patří jen této aplikaci.
- Při čtení počítej s chybějícími, poškozenými nebo ručně upravenými daty: `JSON.parse` patří do `try/catch`, výsledek musí mít očekávaný tvar.
- Záznam bez platného `id` a textového `name` se nemá vykreslit.
- Smazání návyku musí zmizet i v tabulce `habits`, ne jen z obrazovky.
- Data v `localStorage` může číst každý skript na stejné origině. Proto na stránku nepatří cizí skript, který k tomu nemá důvod.

## Externí skripty přes CDN

- Každý `<script src>` a `<link href>` mimo vlastní soubory vypiš: adresa, k čemu slouží a jestli je nutný.
- Povolený je jen důvěryhodný zdroj, který aplikace opravdu používá. Neznámé domény, zkrácené URL a skripty vkládané až za běhu jsou nález.
- Zkontroluj, že CDN skript nejde přepsat uživatelským vstupem (adresa není složená z hodnoty formuláře, z `localStorage` ani z řádku databáze).
- Tam, kde to CDN nabízí, preferuj konkrétní verzi a atribut `integrity` (SRI). U Tailwindu přes CDN poznamenej, že oficiální runtime skript SRI běžně nepoužívá a při výpadku CDN se stránka má pořád dát otevřít jako HTML.
- Po načtení stránky ověř v nástrojích prohlížeče (záložka Síť), že se nestahují další skripty, které v HTML nejsou. Po přihlášení přes Google se navíc očekává přesměrování na Supabase a Google, ne další skrytý skript ve stránce.

## Výstup auditu

Ke každému nálezu uveď soubor nebo místo v projektu Supabase, proč je to riziko a jak to opravit bez změny chování aplikace. Když je kontrola v pořádku, napiš to výslovně u dané položky. Na konci shrň, jestli aplikace v tomto rozsahu obstála. Zvlášť uveď, jestli data v `habits` drží pravidla řádků, nebo to z repozitáře nešlo ověřit.
