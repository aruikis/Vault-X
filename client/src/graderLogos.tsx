// The official logos of the five grading companies Vault X slab
// scanning supports (Anthony, Nov 5, 2026: the Search tab's "We
// support:" row). These are the companies' real logos, used as
// served by their own sites — never redrawn, and presented in
// their native official colors (see GraderSupportRow below for
// the light backing plate each one now sits on):
//   PSA     — official SVG from psacard.com brand assets
//             (psacard.com/psa/images/brand/favicons/psa-favicon.svg)
//   SGC     — official SVG from gosgc.com (gosgc.com/assets/img/logo.svg)
//   CGC     — official CGC Cards SVG served as the cgccards.uk site
//             header logo
//   Beckett — Beckett Media's official logo (beckett.com itself
//             rate-limits automated access, so the copy comes from
//             the Wikipedia-hosted official logo file), cropped to
//             its artwork and stored as a small PNG data URI
//   TAG     — official logo PNG from TAG's own store CDN
//             (taggrading.com/cdn/shop/files/TAG_Logo_Official__NoText_Black_Outlined_260x.png)
// The SVGs ship as bundled asset files; the two PNGs ride as data
// URIs so their bytes stay owned by the app either way.

import psaLogo from "./assets/graders/psa.svg";
import sgcLogo from "./assets/graders/sgc.svg";
import cgcLogo from "./assets/graders/cgc.svg";

const beckettLogo =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAGcAAABwCAMAAAA0TJ7oAAAB/lBMVEXV2d+cm52SmJzV1Nhbj67T1NlhXl+gpaxwbm/e3uGhnqCPtMkgh8Zpps" +
  "ujy9wWXo0jHBplmbajxtYshLdBPD1/f/+ds8FvnLt///9ubqtVqqpypsWDfHunrPObt8rDwL4AAP+BfoCq//96enpIe5qxydjsruw/f38/f79G" +
  "QD5lZGX/f///qqo/Pz8AAH8/fz9DPkJ/f4J/v/9ZmcJ//395weaJgX+q/6rAvr7Av8LExL0AAADq5uX+/v7Z1tbMyMkDdbcNWYoIa6b49fQLY5" +
  "jh3Nu5tbfl4d76+/yuqKr8+/wCe8K+vr6qqanBvL1/f3/59/np5+ro5ujCvsBJRkfY1tnh3uH49vjp6OsMUXv49/k7Nzc1mNPo5unK4+6LhoeZ" +
  "lJVTmsZ/v79Zk7lrZmdYVVb49vh4dXWjnJrKyMrNy86RsMDr6ewqeaq/v/9VVVXX1dfp5ukuKCiGhoaHhoempqbX2NjZ1tgFTHlmZWYA//8maJ" +
  "FUoc64uLnl5ecAf38AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACamQiOAAAAgHRSTlNgXpqh5xvX7aDkJJH+2Z" +
  "n9/6dt/fkC6HwCCgOo/whz/wHYAzf/7AgEBP9mAgMEAgT/qgRpAv//A3beIwD+Bf39/v7+/f7+/f5R/i7+BAT+Am+uz/760fywc/6O/f+PWvv8" +
  "/AT9+vfO+f5K0edN/AQDriz+rM42M4r9zQH//1EPA3yQ2bUAABBsSURBVHjanVqJYttGkgUpUZct2YmdTDKb2Mlkkp2dmd2ZvY++SLYAAhDvO6" +
  "Rp0o7ulceSLUs+YufX51UDJAGQlOR0YlIEgX6o6levqhq02DVDlCrmjYn0+XC4wY729t5vHJwfsaPztXRqg9G3JXHdLMxi1w/xqoSXN29SX/5r" +
  "irGVPbHyEhOL3X56eM7Ydxs3mOJqnFKlwn54lXp5kGZsrXlGxjGxsvdtmj2HGfffsEyKpQ7O11IZxiqlX4kjggtTu81U6QhmNEWJjoiV5l9XBN" +
  "tgmeZeGvjv31t7e+dkoHHhr7LnuxSWZa3/6n2apj9jG88Z+S3VBxBLNddefmvu5H4qNRSv4NLnlY/GAQD81V8T7KK/e75SYqn+Gg6/ei6aTUCf" +
  "C5ZuFtlRhj3HHQiRYenhy41fY49YbQ71wRvjKHH0YANvb9bWVj+kVlZSbG0lJQ720t+lMfVZ8w2d/l68aQJJfLTfLt405S7mAwNelUbwXGrtZT" +
  "ojiGn0dXEj9fLbc1Fhf+ynWAnkP2uupMH70kfilNj7/q46wCSp5u75y/fzbpRA3+/tXQC5SOvI0q8WkWEujjDsgae0bv6RbaylyPOi8s+VSgSN" +
  "bMCZmVfpFBHg4j7WUnzM+oiieXvOUi88uft/LNSDRfdjxl+O1vpHxmdCFIW4AY5ZgGAVBCKEhOX5lbpSeU4XpJtvxBR3FimJ82fG/O5+D7dGiv" +
  "aKMcFuNlLpDF3CRNe6ELOXWTNhU5O8zUW4npUKu/EwXmM93ZatwcxSWQkYv865UvtCVEKX3HQ8DydwtSM5ryWBrDhMlUuuPO5HzhLFp0+fFukl" +
  "Noq/m7fc7GtMscq5rIn4okZxSsLnivOR7N1wVf4g5lBQdByPF+QgHrExHFaTNne8VuReBPvaevz4sUUvsWFZZM83YlYYfTlSXNrVGJAVPcOF16" +
  "TnWKw4OVhkW/95+9Hc8WRzy2czOkM4ngfP8dgSWdPvK6IOc5SnrIjnRUVsPcru5OeMnZ3bP28J9ts4zmdMSMfD/Up3Hg6BY3UKvOzJbvQE/Ll1" +
  "eyefy/1IIxeM4K98duf2psX+LWlRveEpbsvLIN5jOOZzVUpul512nAa4g82d7PYYIjJ+zMGmJ5+yLxNhVJOOAhNaIqJX1tip+y4bwG1SOdqN0+" +
  "13bOlRNj8Hh0Y2C6BSfIFc7ii7YCtf+Gdj/bbGa6f3xbos2FIpnYgxXLiZzeYWjOzOk8fsv+PMritFU2Vg2VEIZAXftJTkvpQFgukkogew3y/G" +
  "AdCmSDi6ypW0bXkkuHTOgnrGMtytSofLnpS2Ulx3koH+W7Z0O7u9CGc7e3sLLIvhaAmDuNXj3FliEZwBzIDgwFzwvpZUgyJ7/GgxDi2RYP8Rdb" +
  "OWNJlc51I7KjA2gqNkQ0pEcjcSpiGO+ySbz11h0INIFGFezKIwHQYY4U5wBKvBX7aDEJVafT6j6X9j7s8xnO24cfkdGPQ2SmyoJCZTDt7C2w54" +
  "TTjcVo6tbTg0mXNgz8/5fNSAuHUw6DHYH3EclpuTQZhTVic4sAcU4LyALz3pzoj132ZwjEBEVuh2LFhB7HKZ00AQrUdwhEvQdqGAQK4LcR1OLn" +
  "trM2ZRfucf2D/Gie2AcAWb5LTKMgEOZXPZht+kKquWmK3AIjhYGazNvQdiMzteKjoEnF9iodprO0RewvHDOIU7BRtwDcIpgpnNXROc7WDknt1i" +
  "n97bnnwEzicxHJCiR7NJzTlEGfMzi6KqBt3hOoCZU7eGONshzba3s7dE5lmEdDM4cD0BAQczWhplAOxpKd4NcHiHzUv6wHmSz29PB+whnOnIJn" +
  "BIyjS4xpXFMhI5/GuL+aqxLo0acK677GY44iKKk8/GeGBiqIu1KXN5IRCrxzCKuQgnil2njRy4aH1m7HlwJ4pzb4v9ISG9NOVDyS9POadYsaA5" +
  "CCoHODDTac0ra2ZxUmJ5O4bjJ1MJvKQhCZgYmo3MabEuZI3bBRzUco4YzMN5t/VJDCa7KX6ZLUZw94rqNNkwOCdGwwuIVBwfzONbMYmTW56Qmm" +
  "Dy9yzUhwm/caeBkCxQCCnEqiXcNoUuHUAhWk1q9XycXC7OAvFlsokQHSoSIDwQGcVd4jXSNSGjMmho9wZ8y0eNIXOW/RlvU/HUKCvbtklnUMpZ" +
  "7okvba0pyTlcz23Jikmc2Ft+OSrWU6AeL5P0aC7bvZ5r1fhJlz4ZmejMLawJZzvqt4gt+eyyxb6YB7NPmVPCAtnhum4dczmoK1I3HGuJj8Khqv" +
  "SnkzkbIcQDRD3NKVUdcXlqKeIeZVOJBklai/yWyy8a926JGYMErTq81KCp23hZso4puTrc5Fi+mNeLcfLPNmfUN6wRuCrTeiBSl6wW1aj46FAJ" +
  "ohbyOoaDvB0by0mLgFOnG2+UKVYRSl2rpqjPQ+yAbY7yF/jtpytxtpeTPEW3RSWUV25TTnVk1eoZYaO/8a8lxI1wHsUbFUpI8fYkUwlrEYKBJb" +
  "7ltxUVqaQHjlpiN7NnazMOlFvOvP0i5jekNaMHpmKXNaOjoLlN9T1g3Xmt6QzO7X/3nyQ8F0t0yNEu6yqH9MBG7Sl9qkNOpW2sU+rS1/MyXYAT" +
  "WROkz1v3pp/MCkW0x0TPmcCEcBv0TQ5ExnI7bssUJjjq77fbtStxsjQgnG/FT8GHMc6zT9nTaTL129A0OIqWB/Su7rsWEOoUUsjmSx1E7uVCnM" +
  "nIZ3/D2K2soV02BNu+Jf4lmn0Ur+NFkaCBYNAdChvSh4KCDpnCoXgTnG8+fRY5ko1Rm1phlAa1DpUclL9JDxBPyKMPQ0GQTveG9jxensF5O12f" +
  "NpEac9oUNVo1qlYH2Q3GmPqeT9qIK3GywBFX49QdanQcxzRutqd8y207DZNdHboFb54izNiThz0Jv+WikiBYh9xjMiq9NerIp9SF2zwYaq4izO" +
  "J88gsKnuxCnOJnLu44nBNmof60aHcC/CvQAGKN3cBv279h6Xf5OE68PYMalG0qOqizVtoXqK87xAnogU1C5PqzjpuxZ/tW+l3MnOz2dlp8NhXR" +
  "M1SFVB1QkFIZgvqaNrLQ0FObBeRjwVsfZvvghD2537/LxWCyuTsPJnGKooOf+CroSyBnpnMzCZQ2XGh1lLRcLo9FRczixGaNs88gZ8a5TogP/8" +
  "u5OJUqmFRW/R7hsG5tqYbcqkkSBLTBOWHX4GDsxN1GNJiojgUKuCg/zZRc1zTKKKvETimkOElCuUX7lt5SQhII504CJI6Te3dr3NlTCe9oWXeR" +
  "s0lzoHSyDpwis1CgSmKfDOphb1XMw9nJLhxkzjeVsdtcxyMERUFKiqbUPvEApb1H1RxAyh6yattzRPyJG4qx5Tv5OTg7ZoDUdyb9toDbgoiH4H" +
  "hUJwYtvIVSeKnhUD2HCrVBGdxr1PxYFJVY7dlcHIMEGJA6pA685l82HEMqCn5NElNDarJMr1IuSz4eVJHIWjSKvhHH72hLb649tPHzyThG8X7a" +
  "hoJFZsPUvuE1XigjRbSnAd+uT8ktPhPLtP01b8CY1+/SEZgl9PMOlWqh5kBHB/StZXrWJdrzoS0R6ES5ge9Wp6R7+5RZd8icGQwiwOvXy1sRmN" +
  "aqw1WgY9QoUGarGcW0QmupFDFFD50F2g3VOIoqrLp8JzdbXKMJev36x99/34vA1JxhMINxnClCBtN9MTpjIEOf2gbHHnm2ec7y9gvRXX2d+xFT" +
  "xgc+v1teXUfHFG7yCZbptEdeoJzjuWQ3ZJQ12a03OqERwmU6zRupfUwhvmDu+urnq/+P/6MDhz7/fl3rjs+KIgwy0dHOyEFB4JASaNMwdsZpZm" +
  "zPvkl/ZgtDeQ3NnVVcsUQ2fxCLx4cJ/79mZy3NPQ8i4FF6k6rsoFuYPBGxJt2XJHY4ngrSoIOQlWrVv+6JhpiImiNt6VF2o5bAwz1L2pRP4rjc" +
  "CYzlZh/OSAOkDmk8I64aY7QuRMB4hJbFzEBL4EweMoz340VNRqKrUCiXCUeNlHuDZzQldqJGtK/mlBWfDhhWHV9tTUsUpULOgftwYZkC6nC1fT" +
  "0QzDoGAeBnhF4h2CMwtJODyb6UFWnECShsHUxbjC5WgajXAv3AlrwRFqMdBA6A7CBEI3uTVuzpD3Uo9rhMaVDFurp67dMteM1ZpVTgPFShQ0yE" +
  "yv1IaWJFTvepvjYnYg3Bc0/ygudB6q4EIq85xGdFpWdIJdtut6rR62LPs4RbN80QDzIsSWsZVPXF1TgfHMNnCnRpSk6MVjf+ENWKb5b0tMmtYI" +
  "GnCrTtQ1Ttmh3bRY+DkZA/NwoNV1GkB3TqVN1YNROzx9fcrF/wv2Ee4SC9ZxaYRBm+yp2yo4xA03XKTNHW+7HKNobT05MsFPIbrTmioCMYY7MF" +
  "cfAYvMrLZZw15vO42pXaX+A3IUAEBEAUxhDcWedVXwRPWKfD/CrFr9blJA9MgWgL1hVi8fNtIgLIPY4iYl4Bighf1HvujD1uLYhN2ocKby1ofC" +
  "HU/hXPt3EHcAN5uc3HMBp60nCMlLdOTy8vLevIDMv6n2PQBUojC3IijYbSUtWrVz7fZgJJwO+ZeA3uDxRCBJXxguGYNTaDfBUcdaCEgXyG66KO" +
  "L/3ZH0ZYM2vrVzuUqzDKKmBp6EOdHGHsEzsJK7hEDnwx54cOyd8fiGo9KBHCeDU1mAEJ/9JB5hhD6fAr8xgkvI7q3Ktxgv0524yxuwMpOhxK7a" +
  "0MR19xPWqODnfxzg8PnDjNgtNx/tnVOOIHIVqYYAxEbLB375YRvndXwLy7nkbqVy9sbfd3tfbu0gMRvTLUE/U012l5ITKlytzfH4g/iaL54YW0" +
  "dcwgzLaHl/uYl/c9W2ld7ttaj15wvdrHPQF2L4ZDJfVFKBbFRF4IPwr/ZECVSMxxzuGLQ334VZNwDkYjrZ0XBa0PgTMiHJSUL2TCHtUadMfim8" +
  "xzwrKWEBDSsZM45WHfKx/ex5z3PY1Zyphe7+5pPfwnmOP9l7p7qBM4hv+tpYHrR+35E3M7LXpCR3HR4Amch57u97mH++f9oXYcWhbuNZFqDsjG" +
  "oeM0d3XCb2pSA4xVLqh7Ozrkyhwc50Af7uLeYcvB8HCotPPV4eEhPWfb3ZN6+BXsuivn4JiAk2PZDp83cpIos/f3cAbn0Ob0XyJSQ0mj2vXwwE" +
  "vgNIw5gOE6lNPx7wL26YuCDLaybDvGuDlSEFMFHVse29iDICeY/WSdSJsIgefGOFNdtE3TEs1M0RwVidLAnoKWZYOj+LQSmdZv9FC6EOCEgqgi" +
  "s69zXq/XaoOBZXUHg1ptab1eb7VCVW2Hrc7YAQGOVPsfEr/bQPtqhIBEijrH0be7e83+gcTMvV616vq+P2d/yaQ7fOV2B7X6utpt7u0eDKmKp/" +
  "UhuPWZ+k2w0yCHAMgb7q40m/1+3+skHx4hnxYpyEslkfyFlzjZfdG/T1AjZ0w33p35HcqJDBfVNl2D560OD1arQaIuxmr2hD2Tgt4fjZCNzGiY" +
  "kgyzHYtY3SuMfBqcQqjuS0uWuPmP38wUbveSFCVIDraZj1sxHlD7E2wg0L96revHtOljBiSye3l6fKxMLtetRD9HgtBu83qvOpakUuljUUrF0n" +
  "Sr/OwCcklhyhJ9Y71WHRc0ovjnX2HJxH/F4hguk6mOG6C/A14kHz5W0ZRiAAAAAElFTkSuQmCC";

const tagLogo =
  "data:image/png;base64," +
  "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";

export const GRADER_LOGOS: { name: string; src: string }[] = [
  { name: "PSA", src: psaLogo },
  { name: "Beckett (BGS)", src: beckettLogo },
  { name: "SGC", src: sgcLogo },
  { name: "CGC Cards", src: cgcLogo },
  { name: "TAG", src: tagLogo },
];

/** The Search tab's "We support:" row (Anthony, Nov 5, 2026):
    the five grading companies' real logos in one clean row at
    the very bottom of the Search tab. Every logo renders in
    its NATIVE official colors — no filter, no monochrome
    treatment, the artwork files are the companies' own, byte
    for byte, never redrawn.
    REDESIGN (Anthony, Nov 5, 2026, on-device, superseding
    the earlier bare-on-dark presentation): three of the
    five official marks are dark artwork — TAG's official
    logo is black lettering, SGC's official SVG is filled
    near-black (#1a1a1a), and Beckett's carries thin silver
    and grey detail — so set straight onto the app's dark
    background they washed out to near-invisible ("TAG is
    washed out in black, SGC is washed out in black, and
    Beckett doesn't look good"). Each logo now sits on its
    own light backing plate — a warm-white rounded chip —
    which is the background these marks were designed for,
    so every native color reads exactly as the company
    drew it. All five plates are ONE uniform size (the row
    reads at the old TAG footprint: same size, same
    spacing, one even row), and each logo is contained
    inside its plate with padding, so wide wordmarks and
    compact square marks alike sit at the same visual
    weight. The plates are plain light chips — no recolor
    of the artwork itself, ever. */
export function GraderSupportRow() {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className="text-xs font-semibold tracking-wide text-[var(--dim)]">
        We support:
      </p>
      <div className="flex flex-wrap items-stretch justify-center gap-2.5 px-2">
        {GRADER_LOGOS.map((logo) => (
          <span
            key={logo.name}
            className="flex h-11 w-[76px] items-center justify-center rounded-lg bg-[#f5f3ee] px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.10)]"
          >
            <img
              src={logo.src}
              alt={`${logo.name} logo`}
              className="max-h-full max-w-full object-contain"
              draggable={false}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
