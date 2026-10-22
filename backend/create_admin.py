"""Create a staff account.

    python create_admin.py "Student Cell Head" admin@ghrce.edu.in

Admin accounts are not self-service — there is no sign-up route for them, so
this script is the only way one gets made. Run it once per staff member.
"""

import getpass
import sys

from sqlalchemy import select

from database import Base, SessionLocal, engine
from models import Admin, Student
from security import hash_password

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print('Usage: python create_admin.py "Full Name" email@ghrce.edu.in')
        raise SystemExit(1)

    name, email = sys.argv[1].strip(), sys.argv[2].strip().lower()
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        if db.scalar(select(Admin).where(Admin.email == email)):
            print(f"{email} is already an admin.")
            raise SystemExit(0)

        if db.scalar(select(Student).where(Student.email == email)):
            print(
                f"{email} already has a student account. Use a different address "
                "for staff access, so the two roles stay separate."
            )
            raise SystemExit(1)

        password = getpass.getpass("Password for this admin (at least 8 chars): ")
        if len(password) < 8:
            print("Too short. Use at least 8 characters.")
            raise SystemExit(1)
        if password != getpass.getpass("Confirm password: "):
            print("Those did not match.")
            raise SystemExit(1)

        db.add(Admin(admin_name=name, email=email, password_hash=hash_password(password)))
        db.commit()
        print(f"Admin created: {name} <{email}>. Sign in at the normal login page.")
