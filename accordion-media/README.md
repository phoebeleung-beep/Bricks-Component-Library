Installing in Bricks. Copy the JSON file's contents and paste it into the structure panel. It's the same clipboard schema you've been using, and everything is native Section, Container, Block, Heading, Text and Image elements. The CSS lives in the section's Custom CSS, so you won't hit code-signing. Then add p-accordion-media.js once, site-wide, via Bricks → Settings → Custom code (body footer). It auto-starts on any .p-acc section, so it won't affect other pages. Written this way, it can drop straight into the p-bricks-animations plugin later as an enqueued script.
Controls after pasting:
	•	Effect: set the data-p-acc-effect attribute on the section to wipe, curtain or fade.
	•	Default open item: data-p-acc-open="2".
	•	Allow closing: add data-p-acc-toggle so users can close the open item.
	•	Timing and accent coloInstalling in Bricks. Copy the JSON file's contents and paste it into the structure panel. It's the same clipboard schema you've been using, and everything is native Section, Container, Block, Heading, Text and Image elements. The CSS lives in the section's Custom CSS, so you won't hit code-signing. Then add p-accordion-media.js once, site-wide, via Bricks → Settings → Custom code (body footer). It auto-starts on any .p-acc section, so it won't affect other pages. Written this way, it can drop straight into the p-bricks-animations plugin later as an enqueued script.
	•	Controls after pasting:
	•	Effect: set the data-p-acc-effect attribute on the section to wipe, curtain or fade.
	•	Default open item: data-p-acc-open="2".
	•	Allow closing: add data-p-acc-toggle so users can close the open item.
	•	Timing and accent colour: the three CSS variables at the top of the section's custom CSS.
	•	Images match items by order. To add an item, duplicate an item and duplicate an image. Text, spacing, typography, colours and breakpoints are all editable in the normal panels.
	•	Behaviour details:
	•	Image position: on desktop the image is sticky, so it stays in view if the list gets tall.
	•	Tablet and mobile: the layout reorders to heading → sticky image → list. Without this, tapping a lower item would change an image that's already scrolled off-screen.
	•	Rapid clicks: the outgoing image stays underneath until the new one fully covers it, so you never see a gap.
	•	Accessibility: each title becomes a real <button> inside its heading, with aria-expanded, and arrow keys move between items. Reduced-motion settings are respected.
	•	Panel height: opening uses the grid 0fr → 1fr trick, so no height is measured in JS.
	•	Things to check on your install, since I couldn't test inside Bricks itself:
	•	Placeholder images: they're external picsum URLs. If they don't render after pasting, just pick images from the media library.
	•	Mobile reorder: it relies on the Content block being set to display: contents at tablet portrait. If Bricks ignores that value, the mobile order falls back to image-first.
	•	Builder view: in the builder all panels show open and only the first image is visible, because the JS doesn't run there. Select other images from the structure panel.
	•	Sticky header: if your site has one, raise the Media block's top value at tablet so the image doesn't slide under it.
	•	ur: the three CSS variables at the top of the section's custom CSS.
Images match items by order. To add an item, duplicate an item and duplicate an image. Text, spacing, typography, colours and breakpoints are all editable in the normal panels.
Behaviour details:
	•	Image position: on desktop the image is sticky, so it stays in view if the list gets tall.
	•	Tablet and mobile: the layout reorders to heading → sticky image → list. Without this, tapping a lower item would change an image that's already scrolled off-screen.
	•	Rapid clicks: the outgoing image stays underneath until the new one fully covers it, so you never see a gap.
	•	Accessibility: each title becomes a real <button> inside its heading, with aria-expanded, and arrow keys move between items. Reduced-motion settings are respected.
	•	Panel height: opening uses the grid 0fr → 1fr trick, so no height is measured in JS.
Things to check on your install, since I couldn't test inside Bricks itself:
	•	Placeholder images: they're external picsum URLs. If they don't render after pasting, just pick images from the media library.
	•	Mobile reorder: it relies on the Content block being set to display: contents at tablet portrait. If Bricks ignores that value, the mobile order falls back to image-first.
	•	Builder view: in the builder all panels show open and only the first image is visible, because the JS doesn't run there. Select other images from the structure panel.
	•	Sticky header: if your site has one, raise the Media block's top value at tablet so the image doesn't slide under it.

***** If the icons are missing, replace the p-accordion-media.css in Section - P · Accordion Media
