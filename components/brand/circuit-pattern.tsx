/**
 * Hoạ tiết trang trí "mạch điện" (circuit-board trace) — bản 5, thay
 * bằng file SVG mới bạn gửi ("đổi pattern này đi") — layout mảnh hơn,
 * bỏ hẳn nhóm hình lục giác (hexagon) của bản 4, thêm nhóm vòng tròn
 * viền (rings) rải đều dọc dải hơn. Giữ nguyên 100% path/toạ độ gốc
 * của bạn — chỉ chuyển attribute kebab-case sang camelCase cho hợp lệ
 * JSX (stroke-linecap → strokeLinecap...) và bỏ `class`/`id` không
 * cần thiết cho việc style (không có rule CSS nào nhắm vào chúng).
 *
 * Vẫn dùng đúng kiến trúc theme của bản 4: `currentColor` cho
 * stroke/fill + 4 CSS variable cho opacity từng lớp — màu + giá trị
 * theo theme đặt ở `app/globals.css` (class `.pattern`, chọn theo
 * `[data-theme="dark"|"light"]`), không đặt trong component này. File
 * mới không có nhóm hình lục giác nên chỉ còn 4 lớp dùng var: subtle
 * (nhóm `lines-subtle`), main (nhóm `lines-main`, dùng chung cho cả
 * `rings` — đúng cách bản 4 đã gán rings theo main opacity), strong
 * (nhóm `lines-accent`), node (nhóm `nodes`). Opacity gốc bạn để
 * trong file (.16/.34/.62/.76) khớp gần đúng giá trị theme tối hiện
 * có nên giữ luôn làm fallback mặc định cho từng var.
 *
 * Container/kích thước dải giữ nguyên như bản 4 (không đổi theo yêu
 * cầu lần này): `position: fixed` sát mép phải, cao hết viewport,
 * dải rộng 65px (80px từ `sm`), `preserveAspectRatio="xMaxYMin
 * slice"` neo góc trên-phải.
 *
 * Chỉ trang trí — aria-hidden, pointer-events-none, không ảnh hưởng
 * tương tác/nội dung.
 */
export function CircuitPattern() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed right-0 top-0 z-0 h-dvh w-[65px] overflow-hidden sm:w-[80px]"
    >
      <svg
        className="pattern"
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        fill="none"
        preserveAspectRatio="xMaxYMin slice"
        role="img"
        aria-labelledby="circuit-pattern-title circuit-pattern-description"
      >
        <title id="circuit-pattern-title">Minimal vertical circuit pattern</title>
        <desc id="circuit-pattern-description">
          Transparent vector circuit line art concentrated along the right edge.
        </desc>
        <g
          id="circuit-pattern"
          color="currentColor"
          stroke="currentColor"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          <g id="lines-subtle" opacity="var(--pattern-line-subtle, .16)" strokeWidth="1.25">
            <path d="M1762 0L1818 72V194L1840 216V376L1824 392V632L1842 650V916" />
            <path d="M1810 0L1868 78V146L1848 166V302L1866 320V550L1848 568V824" />
            <path d="M1858 0L1910 68V214L1892 232V438L1912 458V708" />
            <path d="M1728 58L1774 116V258L1794 278V482L1776 500V768" />
            <path d="M1906 0V112L1880 138V276L1898 294V528" />
            <path d="M1798 604V740L1782 756V986" />
            <path d="M1878 684V842L1896 860V1080" />
            <path d="M1820 792V1012" />
            <path d="M1918 760V936L1902 952V1080" />
          </g>
          <g id="lines-main" opacity="var(--pattern-line-opacity, .34)" strokeWidth="1.75">
            <path d="M1784 0L1832 62V180L1812 200V348L1834 370V594L1816 612V884" />
            <path d="M1832 0L1890 74V180L1870 202V390L1890 410V618L1872 636V938" />
            <path d="M1884 0L1920 46V156L1902 174V344L1920 362" />
            <path d="M1720 94L1758 140V314L1778 334V526L1760 544V820" />
            <path d="M1748 0L1792 58V176L1772 196V426L1792 446V700" />
            <path d="M1918 214L1898 234V508L1918 528" />
            <path d="M1816 612H1854L1872 594" />
            <path d="M1760 544H1798L1816 526" />
            <path d="M1834 370H1870" />
            <path d="M1872 636V770L1892 790V1028" />
            <path d="M1760 820V1006" />
            <path d="M1816 884V1080" />
          </g>
          <g id="lines-accent" opacity="var(--pattern-line-strong, .62)" strokeWidth="2.25">
            <path d="M1808 0L1850 54V132L1830 152V286L1852 308V514" />
            <path d="M1860 118V270L1880 292V476L1860 496V714L1880 734V900" />
            <path d="M1918 84L1892 116V184" />
            <path d="M1918 402L1898 424V580L1918 600" />
            <path d="M1792 700V930L1774 948V1080" />
          </g>
          <g id="rings" opacity="var(--pattern-line-opacity, .5)" strokeWidth="1.5">
            <circle cx="1830" cy="152" r="6" />
            <circle cx="1772" cy="196" r="5" />
            <circle cx="1870" cy="202" r="6" />
            <circle cx="1778" cy="334" r="5" />
            <circle cx="1890" cy="410" r="6" />
            <circle cx="1816" cy="526" r="5" />
            <circle cx="1872" cy="636" r="6" />
            <circle cx="1792" cy="700" r="5" />
            <circle cx="1760" cy="820" r="5" />
            <circle cx="1892" cy="1028" r="6" />
          </g>
          <g id="nodes" stroke="none" fill="currentColor" opacity="var(--pattern-node-opacity, .76)">
            <circle cx="1818" cy="72" r="3" />
            <circle cx="1850" cy="54" r="3.5" />
            <circle cx="1892" cy="116" r="3" />
            <circle cx="1830" cy="152" r="3" />
            <circle cx="1772" cy="196" r="2.5" />
            <circle cx="1870" cy="202" r="3" />
            <circle cx="1778" cy="334" r="2.5" />
            <circle cx="1852" cy="308" r="3" />
            <circle cx="1890" cy="410" r="3" />
            <circle cx="1918" cy="402" r="2.5" />
            <circle cx="1816" cy="526" r="2.5" />
            <circle cx="1872" cy="636" r="3" />
            <circle cx="1792" cy="700" r="2.5" />
            <circle cx="1760" cy="820" r="2.5" />
            <circle cx="1880" cy="900" r="3" />
            <circle cx="1892" cy="1028" r="3" />
          </g>
        </g>
      </svg>
    </div>
  );
}
