import Image from "next/image";

const Header = () => {
  return (
    <div className="container flex h-[120px] shrink-0 items-center justify-center px-4 lg:h-[160px] lg:px-0">
      <a href="/">

          <Image src="/athena-tutor-4x3.png" alt="logo" width={160} height={120} />

      </a>
    </div>
  );
};

export default Header;
