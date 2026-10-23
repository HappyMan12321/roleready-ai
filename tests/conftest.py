import pytest

from roleready.demo import DEMO_JOB, DEMO_RESUME, demo_analysis


@pytest.fixture
def sample_analysis():
    return demo_analysis(DEMO_RESUME, DEMO_JOB)
