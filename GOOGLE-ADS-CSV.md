# Google Ads Data Manager Export

The download is a header-first UTF-8 CSV with nine fixed columns, quoted empty
fields, CRLF records and a final newline. Order ID is always the last populated
field. The writer round-trips through a strict CSV parser before returning a file.
Accounting details stay in the dashboard, not in the Google import schema.

Map these fields once after replacing the previous 13-column layout:

| Source | Google Ads destination |
| --- | --- |
| Google Click ID | GCLID |
| Phone Number | Phone number (already SHA-256 hashed) |
| Conversion Time | Conversion date/time |
| Conversion Value | Conversion value |
| Conversion Currency | Currency |
| GBRAID | GBRAID |
| WBRAID | WBRAID |
| Order ID | Transaction ID |

Select Europe/Bucharest for the timezone of Conversion Time. The strings stay
`YYYY-MM-DD HH:mm:ss`; values are gross profit, with decimal points and RON.
Conversion Name is retained for filtering when appropriate. In Data Manager the
destination conversion action is configured on the connection itself.

Phone-only rows require a destination that supports enhanced conversions for
leads and applicable consent. A click-only action cannot attribute rows without
a click identifier simply because a phone column exists. Do not hash an
already-hashed phone a second time, and do not invent consent values.

The uploaded sample had 13 fields in every record under strict CSV parsing.
Error 4017 was therefore not reproduced locally. Verify the actual connected
Drive file, update that original file instead of creating an unrelated copy,
and refresh/remap its cached schema. Acceptance must be checked with a Google
Ads test import; local CSV validation alone does not prove import acceptance.

Reference: https://support.google.com/google-ads-data-manager/answer/16768724
